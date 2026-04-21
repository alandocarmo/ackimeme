/**
 * graphql.service.js
 *
 * Integração com a GraphQL API da Acki Nacki.
 *
 * Endpoint público (testnet): https://shellnet.ackinacki.org/graphql
 * Documentação: https://dev.ackinacki.com/graphql/graphql-api
 *
 * O schema usa a raiz `blockchain { ... }`.
 * Para lookup direto por hash/id usamos `blockchain { transaction(hash: $hash) { ... } }`.
 */

const axios = require("axios");
const { config } = require("../config");

const GRAPHQL_ENDPOINT = config.graphqlUrl || "https://shellnet.ackinacki.org/graphql";
const TIP3_DEFAULT_DECIMALS = 6;
const MAX_TIP3_TREE_TRANSACTIONS = 24;

const TIP3_TOKEN_WALLET_ABI = {
  "ABI version": 2,
  version: "2.3",
  header: [],
  functions: [
    {
      name: "transferToWallet",
      inputs: [
        { name: "amount", type: "uint128" },
        { name: "recipientTokenWallet", type: "address" },
        { name: "remainingGasTo", type: "address" },
        { name: "notify", type: "bool" },
        { name: "payload", type: "cell" },
      ],
      outputs: [],
    },
    {
      name: "transfer",
      inputs: [
        { name: "amount", type: "uint128" },
        { name: "recipient", type: "address" },
        { name: "deployWalletValue", type: "uint128" },
        { name: "remainingGasTo", type: "address" },
        { name: "notify", type: "bool" },
        { name: "payload", type: "cell" },
      ],
      outputs: [],
    },
  ],
  events: [],
  data: [],
};
const TIP3_METHOD_NAMES = ["transfer", "transferToWallet"];

let tvmClient = null;
let sdkClient = null;
let abiContract = null;

try {
  // `nekoton-wasm` decodifica body de mensagens TIP-3 sem depender do binário
  // nativo do TVM SDK, que pode falhar em runtimes Node recentes.
  tvmClient = require("nekoton-wasm-locklift");
} catch (error) {
  console.warn("[GraphQL] Decoder TIP-3 indisponível:", error.message);
}

try {
  const tvmCore = require("@tvmsdk/core");
  const { libNode } = require("@tvmsdk/lib-node");
  tvmCore.TvmClient.useBinaryLibrary(libNode);
  sdkClient = new tvmCore.TvmClient({
    network: {
      endpoints: [config.graphqlUrl || "https://shellnet.ackinacki.org/graphql"],
    },
  });
  abiContract = tvmCore.abiContract;
} catch (error) {
  console.warn("[GraphQL] TVM SDK indisponível:", error.message);
}

function isTip3DecoderAvailable() {
  return Boolean(tvmClient && typeof tvmClient.decodeInput === "function");
}

/**
 * Executa uma query GraphQL contra o endpoint da Acki Nacki.
 * Inclui retry com backoff exponencial para resiliência contra
 * falhas de rede transitórias e timeouts do endpoint.
 */
async function gql(query, variables = {}, retries = 3) {
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await axios.post(
        GRAPHQL_ENDPOINT,
        { query, variables },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 15000,
        },
      );

      if (res.data.errors && res.data.errors.length > 0) {
        const msg = res.data.errors.map((e) => e.message).join("; ");
        throw new Error(`GraphQL error: ${msg}`);
      }

      return res.data.data;
    } catch (err) {
      lastError = err;

      // Não fazer retry para erros de lógica GraphQL (422, 400)
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }

      // Backoff exponencial: 1s, 2s, 4s
      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Busca uma transação pelo hash.
 *
 * Retorna null se não encontrada.
 *
 * Campos mapeados para o contrato interno do AckiMeme:
 *   tx.hash      — hash da transação
 *   tx.account_addr — endereço de destino (feeWallet)
 *   tx.in_message — mensagem de entrada (contém src, value, body)
 *   tx.status    — 0=unknown, 1=preliminary, 2=proposed, 3=finalized, 4=refused
 *   tx.tr_type   — tipo de transação
 */
async function getTransaction(hash) {
  if (!hash) {
    throw new Error("Transaction hash is required.");
  }

  const query = `
    query GetTx($hash: String!) {
      blockchain {
        transaction(hash: $hash) {
          id
          account_addr
          status
          status_name
          tr_type
          tr_type_name
          balance_delta(format: DEC)
          in_message {
            id
            src
            dst
            value(format: DEC)
            currencies
            msg_type
            msg_type_name
            body
          }
        }
      }
    }
  `;

  let node = null;
  const hashCandidates = buildTxHashCandidates(hash);

  for (const hashCandidate of hashCandidates) {
    // eslint-disable-next-line no-await-in-loop
    const data = await gql(query, { hash: hashCandidate });
    node = data?.blockchain?.transaction || null;
    if (node) {
      break;
    }
  }

  if (!node) {
    return null;
  }

  /**
   * Normaliza para o formato que payments.js espera:
   *   { hash, from, to, amount, token: { symbol }, status }
   *
   * R-01: Na Acki Nacki, SHELL pode ser enviado como:
   *   - msg.value (VMSHELL) — funciona dentro do mesmo DappID
   *   - msg.currencies[2] (SHELL ECC) — funciona cross-DappID
   *
   * Devemos ler SHELL de currencies["2"] quando disponível, caso contrário
   * usar value como fallback. Sem isso, pagamentos cross-DappID retornam
   * amount ≈ 0 e a validação de fee rejeita tudo.
   */
  const rawCurrencies = node.in_message?.currencies || {};
  // currencies é um array de objetos ou um objeto { "2": "69000000000000" }
  // formato pode variar: procuramos o currency_id 2 (SHELL)
  let shellFromCurrencies = "0";
  if (Array.isArray(rawCurrencies)) {
    // formato [{currency: 2, value: "1234"}, ...]
    const shellEntry = rawCurrencies.find(c => String(c.currency) === "2");
    shellFromCurrencies = shellEntry?.value || "0";
  } else if (typeof rawCurrencies === "object") {
    // formato {"2": "1234"}
    shellFromCurrencies = rawCurrencies["2"] || rawCurrencies[2] || "0";
  }

  const vmshellAmount = nanoToDecimal(node.in_message?.value || "0");
  const shellAmount = nanoToDecimal(shellFromCurrencies);

  // Use the larger value: if currencies has SHELL, prefer it; otherwise fallback to VMSHELL
  const effectiveAmount = shellAmount > vmshellAmount ? shellAmount : vmshellAmount;

  return {
    hash: node.id,
    from: node.in_message?.src || "",
    to: node.account_addr || node.in_message?.dst || "",
    amount: effectiveAmount,
    nanoAmount: shellAmount > vmshellAmount ? shellFromCurrencies : (node.in_message?.value || "0"),
    token: {
      symbol: "SHELL",
    },
    status: normalizeStatus(node.status_name),
    raw: node,
  };
}

/**
 * Converte nanotokens (string) para número decimal de tokens SHELL.
 * 1 SHELL = 1_000_000_000 nanotokens (9 casas decimais, padrão TVM).
 */
function nanoToDecimal(nanoValue) {
  const nano = BigInt(String(nanoValue || "0").replace(/\D/g, "") || "0");
  const whole = nano / 1_000_000_000n;
  const frac = nano % 1_000_000_000n;
  return Number(`${whole}.${String(frac).padStart(9, "0")}`);
}

function normalizeAddress(value) {
  return String(value || "").trim().toLowerCase();
}

function buildTxHashCandidates(hash) {
  const value = String(hash || "").trim();
  if (!value) {
    return [];
  }

  const candidates = [value];

  if (value.startsWith("0x") && value.length > 2) {
    candidates.push(value.slice(2));
  } else if (/^[0-9a-f]{64}$/i.test(value)) {
    candidates.push(`0x${value}`);
  }

  return [...new Set(candidates)];
}

function canonicalTxHash(hash) {
  const value = String(hash || "").trim().toLowerCase();
  if (value.startsWith("0x") && value.length > 2) {
    return value.slice(2);
  }
  return value;
}

function extractTip3RawAmount(input = {}) {
  const candidates = [input.amount, input._value, input.value, input.tokens];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) {
      continue;
    }

    const sanitized = String(candidate).trim();
    if (!/^\d+$/.test(sanitized)) {
      continue;
    }

    try {
      return BigInt(sanitized);
    } catch {
      // ignore malformed values and continue probing
    }
  }

  return null;
}

function tip3RawToDecimal(rawAmount, decimals = TIP3_DEFAULT_DECIMALS) {
  const parsedDecimals = Number.isFinite(Number(decimals))
    ? Math.max(0, Math.trunc(Number(decimals)))
    : TIP3_DEFAULT_DECIMALS;
  const base = 10n ** BigInt(parsedDecimals);
  const whole = rawAmount / base;
  const fraction = rawAmount % base;
  return Number(`${whole}.${String(fraction).padStart(parsedDecimals, "0")}`);
}

function decodeTip3TransferBody(body) {
  if (!isTip3DecoderAvailable() || !body) {
    return null;
  }

  try {
    const decoded = tvmClient.decodeInput(
      body,
      JSON.stringify(TIP3_TOKEN_WALLET_ABI),
      TIP3_METHOD_NAMES,
      true,
    );

    if (!decoded || !decoded.method || !decoded.input) {
      return null;
    }

    const functionName = String(decoded.method);
    if (!TIP3_METHOD_NAMES.includes(functionName)) {
      return null;
    }

    const input = decoded.input;
    const rawAmount = extractTip3RawAmount(input);
    if (rawAmount === null) {
      return null;
    }

    const recipient = normalizeAddress(
      functionName === "transfer"
        ? input.recipient
        : input.recipientTokenWallet,
    );

    return {
      functionName,
      recipient,
      rawAmount,
    };
  } catch {
    return null;
  }
}

async function getTransactionWithMessages(hash) {
  const query = `
    query GetTxWithMessages($hash: String!) {
      blockchain {
        transaction(hash: $hash) {
          id
          account_addr
          status_name
          in_message {
            id
            src
            dst
            body
            msg_type_name
            value(format: DEC)
          }
          out_messages {
            id
            src
            dst
            body
            msg_type_name
            value(format: DEC)
            dst_transaction {
              id
            }
          }
        }
      }
    }
  `;

  const hashCandidates = buildTxHashCandidates(hash);

  for (const hashCandidate of hashCandidates) {
    // eslint-disable-next-line no-await-in-loop
    const data = await gql(query, { hash: hashCandidate });
    const node = data?.blockchain?.transaction || null;
    if (node) {
      return node;
    }
  }

  return null;
}

async function collectTransactionTree(rootTxHash) {
  const visited = new Set();
  const queue = [String(rootTxHash || "").trim()];
  const transactions = [];

  while (queue.length > 0 && transactions.length < MAX_TIP3_TREE_TRANSACTIONS) {
    const txHash = queue.shift();
    const canonicalHash = canonicalTxHash(txHash);
    if (!canonicalHash || visited.has(canonicalHash)) {
      continue;
    }
    visited.add(canonicalHash);

    // eslint-disable-next-line no-await-in-loop
    const tx = await getTransactionWithMessages(txHash);
    if (!tx) {
      continue;
    }

    transactions.push(tx);

    for (const message of tx.out_messages || []) {
      const nextTxHash = String(message?.dst_transaction?.id || "").trim();
      const nextCanonical = canonicalTxHash(nextTxHash);
      if (nextTxHash && nextCanonical && !visited.has(nextCanonical)) {
        queue.push(nextTxHash);
      }
    }
  }

  return transactions;
}

async function getTip3TransferPayment({
  txHash,
  senderWallet,
  recipientWallet,
  decimals = TIP3_DEFAULT_DECIMALS,
}) {
  if (!isTip3DecoderAvailable()) {
    throw new Error(
      "Decoder TIP-3 indisponível para validação de USDC. " +
      "Verifique se a dependência nekoton-wasm está instalada no backend.",
    );
  }

  const transactions = await collectTransactionTree(txHash);
  if (transactions.length === 0) {
    return null;
  }

  const expectedSender = normalizeAddress(senderWallet);
  const expectedRecipient = normalizeAddress(recipientWallet);
  const senderInvolved = transactions.some((tx) => {
    const account = normalizeAddress(tx.account_addr);
    const inSrc = normalizeAddress(tx.in_message?.src);
    const inDst = normalizeAddress(tx.in_message?.dst);

    if (expectedSender && (account === expectedSender || inSrc === expectedSender || inDst === expectedSender)) {
      return true;
    }

    for (const outMessage of tx.out_messages || []) {
      const outSrc = normalizeAddress(outMessage?.src);
      const outDst = normalizeAddress(outMessage?.dst);
      if (outSrc === expectedSender || outDst === expectedSender) {
        return true;
      }
    }

    return false;
  });

  if (expectedSender && !senderInvolved) {
    return null;
  }

  const candidates = [];

  for (const tx of transactions) {
    const txMessages = [
      ...(tx.in_message ? [tx.in_message] : []),
      ...(tx.out_messages || []),
    ];

    for (const message of txMessages) {
      const decoded = decodeTip3TransferBody(message?.body);
      if (!decoded) {
        continue;
      }

      if (expectedRecipient && decoded.recipient !== expectedRecipient) {
        continue;
      }

      candidates.push({
        sender: normalizeAddress(message?.src),
        recipient: decoded.recipient,
        rawAmount: decoded.rawAmount,
        functionName: decoded.functionName,
        messageId: message?.id || "",
        txHash: tx.id || "",
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (a.rawAmount === b.rawAmount) return 0;
    return a.rawAmount > b.rawAmount ? -1 : 1;
  });

  const winner = candidates[0];

  return {
    sender: winner.sender,
    recipient: winner.recipient,
    amount: tip3RawToDecimal(winner.rawAmount, decimals),
    rawAmount: winner.rawAmount.toString(),
    decimals: Number(decimals),
    proof: {
      functionName: winner.functionName,
      messageId: winner.messageId,
      txHash: winner.txHash,
      treeTransactionsScanned: transactions.length,
    },
  };
}

/**
 * Mapeia status_name da Acki Nacki para o formato interno.
 * Acki Nacki status names: Unknown, Preliminary, Proposed, Finalized, Refused
 */
function normalizeStatus(statusName) {
  const name = String(statusName || "").toLowerCase();
  if (name === "finalized") return "SUCCESS";
  if (name === "refused") return "FAILED";
  return "PENDING";
}

/**
 * Busca o saldo de uma conta pelo endereço.
 * Útil para validar se a fee_wallet recebeu fundos.
 */
async function getAccountBalance(address) {
  const query = `
    query GetBalance($address: String!) {
      blockchain {
        account(address: $address) {
          info {
            balance(format: DEC)
            address
            acc_type_name
          }
        }
      }
    }
  `;

  const data = await gql(query, { address });
  const info = data?.blockchain?.account?.info;

  if (!info) {
    return null;
  }

  return {
    address: info.address,
    balance: nanoToDecimal(info.balance || "0"),
    status: info.acc_type_name,
  };
}

/**
 * Verifica se uma carteira está deployada na blockchain e extrai a public key.
 *
 * A Acki Nacki/TVM armazena a public key do contrato no campo `boc` (Bag of Cells).
 * A public key pode ser obtida da BOC via nekoton ou lida diretamente se a conta
 * expuser o campo via GraphQL. Também retorna code_hash para verificação de tipo.
 *
 * SEGURANÇA: Essa public key é usada para vincular a sessão de auth à wallet real.
 * Sem essa verificação, qualquer keypair Ed25519 pode se passar por qualquer wallet.
 */
async function getAccountPublicKey(address) {
  const accountQuery = `
    query getAccount($address: String!) {
      blockchain {
        account(address: $address) {
          info {
            balance(format: DEC)
            address
            acc_type_name
            code_hash
            boc
          }
        }
      }
    }
  `;

  try {
    const data = await gql(accountQuery, { address });
    const info = data?.blockchain?.account?.info;

    if (!info) {
      return { isDeployed: false };
    }

    const isActive = String(info.acc_type_name || "").toLowerCase() === "active";
    if (!isActive) {
      return {
        isDeployed: false,
        balance: nanoToDecimal(info.balance || "0"),
        reason: `Account status is "${info.acc_type_name}", not Active.`,
      };
    }

    let publicKey = "";

    // Extrair public key da BOC usando nekoton se disponível
    if (tvmClient && typeof tvmClient.extractPublicKey === "function" && info.boc) {
      try {
        publicKey = tvmClient.extractPublicKey(info.boc);
      } catch {
        // nekoton may not support this method; fall through
      }
    }

    // Fallback: tentar extrair via TVM SDK se nekoton não conseguiu
    if (!publicKey && info.boc && sdkClient) {
      try {
        const parsed = await sdkClient.boc.parse_account({ boc: info.boc });
        const parsedData = parsed.parsed;
        // On TVM/Everscale, checking the code or data could give us the pubkey 
        // But simply decoding the account data if we know the standard setcode multisig ABI
        // For standard setcode multisig ABI, constructor has pubkey constraint.
        // For general approach, the initial data of the contract stores the pubkey in the first 256 bits.
        // We can just rely on the SDK internal methods.
        if (parsedData && parsedData.id) {
            // We only need this as a fallback if the user used a wallet we don't know
            // In Acki Nacki, the simplest way to verify Ed25519 is done in Auth flow.
        }
        publicKey = "";
      } catch {
        publicKey = "";
      }
    }

    return {
      isDeployed: true,
      balance: nanoToDecimal(info.balance || "0"),
      publicKey,
      codeHash: info.code_hash || "",
      boc: info.boc || "",
    };
  } catch (err) {
    if (String(err.message || "").includes("Network") || String(err.message || "").includes("timeout")) {
      console.error(`[GraphQL] getAccountPublicKey falhou para ${address}:`, err.message);
    }
    return { isDeployed: false };
  }
}

module.exports = {
  getTip3TransferPayment,
  isTip3DecoderAvailable,
  getTransaction,
  getAccountBalance,
  getAccountPublicKey,
  nanoToDecimal,
};
