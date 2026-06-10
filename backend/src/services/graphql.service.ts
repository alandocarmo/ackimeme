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

import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { config  } from "../config";

let BONDING_CURVE_ABI: any;
try {
  BONDING_CURVE_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, "../abi/BondingCurve.abi.json"), "utf8"));
} catch (e: any) {
  console.warn("[GraphQL] Aviso: BondingCurve.abi.json não encontrado. Syncing de transações pode falhar.");
  BONDING_CURVE_ABI = null;
}

// Audit #1: No silent fallback to shellnet — GRAPHQL_URL must be configured
const GRAPHQL_ENDPOINT = config.graphqlUrl || "https://shellnet.ackinacki.org/graphql";
if (!config.graphqlUrl) {
  if (config.isProduction) {
    throw new Error("❌ Erro fatal: GRAPHQL_URL é obrigatório em ambiente de produção! Não faça fallback para a testnet.");
  }
  console.warn("[GraphQL] ⚠️  GRAPHQL_URL não configurada! Usando shellnet (testnet) como fallback. NÃO use isso em produção.");
}
const SHELL_CURRENCY_ID = 2;

let tvmClient: any = null;
let sdkClient: any = null;
let abiContract: any = null;

try {
  // `nekoton-wasm` decodifica body de mensagens TIP-3 sem depender do binário
  // nativo do TVM SDK, que pode falhar em runtimes Node recentes.
  tvmClient = require("nekoton-wasm");
} catch (error: any) {
  console.warn("[GraphQL] Decoder TIP-3 indisponível:", error.message);
}

import { getTvmClient, getTvmCore, sdkAvailable as isTvmSdkAvailable  } from "./tvm-client";

let sdkAvailable = false;
if (isTvmSdkAvailable) {
  const core = getTvmCore();
  sdkClient = getTvmClient();
  abiContract = core.abiContract;
  sdkAvailable = true;
} else {
  console.warn("[GraphQL] TVM SDK indisponível. Dependências faltando.");
}

export function isWasmDecoderAvailable() {
  return Boolean(tvmClient && typeof tvmClient.decodeInput === "function");
}

/**
 * Executa uma query GraphQL contra o endpoint da Acki Nacki.
 * Inclui retry com backoff exponencial para resiliência contra
 * falhas de rede transitórias e timeouts do endpoint.
 */
export async function gql(query: any, variables = {}, retries = 3) {
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
        const msg = res.data.errors.map((e: any) => e.message).join("; ");
        throw new Error(`GraphQL error: ${msg}`);
      }

      return res.data.data;
    } catch (err: any) {
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
export async function getTransaction(hash: any) {
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
   * Devemos ler a fee de produto de currencies["2"]. msg.value é VMSHELL
   * e deve ser tratado como gas, não como pagamento de criação.
   */
  const vmshellNanoAmount = String(node.in_message?.value || "0");
  const shellFromCurrencies = extractCurrencyNano(
    node.in_message?.currencies,
    SHELL_CURRENCY_ID,
  );
  const shellNano = BigInt(String(shellFromCurrencies || "0").replace(/\D/g, "") || "0");
  const vmshellAmount = nanoToDecimal(vmshellNanoAmount);
  const shellAmount = nanoToDecimal(shellFromCurrencies);
  const paymentSource = shellNano > 0n ? "shell_ecc" : "vmshell_value";

  return {
    hash: node.id,
    from: node.in_message?.src || "",
    to: node.account_addr || node.in_message?.dst || "",
    amount: shellAmount,
    nanoAmount: shellFromCurrencies,
    shellNanoAmount: shellFromCurrencies,
    vmshellNanoAmount,
    vmshellAmount,
    paymentSource,
    token: {
      symbol: "SHELL",
    },
    status: normalizeStatus(node.status, node.status_name),
    raw: node,
  };
}

/**
 * Converte nanotokens (string) para número decimal de tokens SHELL.
 * 1 SHELL = 1_000_000_000 nanotokens (9 casas decimais, padrão TVM).
 */
export function nanoToDecimal(nanoValue: any) {
  const str = String(nanoValue || "0").replace(/[^\d-]/g, "");
  if (!str || str === "-") return "0.000000000";
  const nano = BigInt(str);
  const isNegative = nano < 0n;
  const absNano = isNegative ? -nano : nano;
  const whole = absNano / 1_000_000_000n;
  const frac = absNano % 1_000_000_000n;
  const sign = isNegative ? "-" : "";
  return `${sign}${whole}.${String(frac).padStart(9, "0")}`;
}

export function extractCurrencyNano(currencies: any, currencyId: any) {
  let rawCurrencies = currencies || {};

  if (typeof rawCurrencies === "string") {
    try {
      rawCurrencies = JSON.parse(rawCurrencies);
    } catch {
      return "0";
    }
  }

  if (Array.isArray(rawCurrencies)) {
    const entry = rawCurrencies.find((item) => {
      if (Array.isArray(item)) {
        return String(item[0]) === String(currencyId);
      }

      const candidate =
        item?.currency ?? item?.currency_id ?? item?.id ?? item?.key ?? item?.token;
      return String(candidate) === String(currencyId);
    });

    if (Array.isArray(entry)) {
      return String(entry[1] ?? "0");
    }

    return String(entry?.value ?? entry?.amount ?? entry?.tokens ?? "0");
  }

  if (rawCurrencies && typeof rawCurrencies === "object") {
    return String(
      rawCurrencies[String(currencyId)] ??
        rawCurrencies[currencyId] ??
        rawCurrencies[`currency_${currencyId}`] ??
        "0",
    );
  }

  return "0";
}

export function normalizeAddress(value: any) {
  return String(value || "").trim().toLowerCase();
}

export function buildTxHashCandidates(hash: any) {
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

export function canonicalTxHash(hash: any) {
  const value = String(hash || "").trim().toLowerCase();
  if (value.startsWith("0x") && value.length > 2) {
    return value.slice(2);
  }
  return value;
}



/**
 * Mapeia status_name da Acki Nacki para o formato interno.
 * Acki Nacki status names: Unknown, Preliminary, Proposed, Finalized, Refused
 */
/**
 * Audit #2: Use numeric `status` field as primary source (more reliable).
 * Fallback to legacy `status_name` string for backward compatibility.
 * Acki Nacki GraphQL status codes:
 *   0 = Unknown, 1 = Preliminary, 2 = Proposed, 3 = Finalized, 4 = Refused
 */
export function normalizeStatus(statusInt: any, statusName: any) {
  // Primary: numeric field (never null if transaction exists)
  if (statusInt === 3) return "SUCCESS";
  if (statusInt === 4) return "FAILED";
  if (statusInt === 0) return "UNKNOWN";
  if (typeof statusInt === "number" && statusInt > 0 && statusInt < 3) return "PENDING";
  // Fallback: legacy string field (may be null in some API versions)
  const name = String(statusName || "").toLowerCase();
  if (name === "finalized") return "SUCCESS";
  if (name === "refused") return "FAILED";
  if (name === "unknown") return "UNKNOWN";
  return "PENDING";
}

/**
 * Busca o saldo de uma conta pelo endereço.
 * Útil para validar se a fee_wallet recebeu fundos.
 */
export async function getAccountBalance(address: any) {
  const query = `
    query GetBalance($address: String!) {
      blockchain {
        account(address: $address) {
          info {
            balance(format: DEC)
            currencies
            address
            acc_type
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
  
  const shellEccNano = extractCurrencyNano(info.currencies, SHELL_CURRENCY_ID);

  return {
    address: info.address,
    balance: nanoToDecimal(info.balance || "0"),
    shellEccBalance: nanoToDecimal(shellEccNano),
    // Audit #2: prefer numeric acc_type (1=Active) with _name fallback
    status: info.acc_type_name || (info.acc_type === 1 ? "Active" : "Inactive"),
  };
}

/**
 * Busca o saldo em Nano SHELL diretamente da rede via GraphQL.
 */
export async function getAccountBalanceNano(address: any) {
  const query = `
    query GetBalance($address: String!) {
      blockchain {
        account(address: $address) {
          info { balance(format: DEC) acc_type }
        }
      }
    }
  `;

  const data = await gql(query, { address });
  const info = data?.blockchain?.account?.info;
  if (!info) {
    return 0n;
  }

  // Acki Nacki: 0=Uninit, 1=Active, 2=Frozen, 3=NonExist
  const accType = info.acc_type === undefined ? 0 : Number(info.acc_type);
  if (accType !== 1) {
    return 0n;
  }

  return BigInt(String(info.balance || "0"));
}

/**
 * Busca o saldo em Nano ECC (Extra Currencies) da rede via GraphQL.
 */
export async function getAccountEccBalanceNano(address: any, currencyId: any) {
  const query = `
    query GetBalance($address: String!) {
      blockchain {
        account(address: $address) {
          info { currencies acc_type }
        }
      }
    }
  `;

  const data = await gql(query, { address });
  const info = data?.blockchain?.account?.info;
  if (!info) {
    return 0n;
  }

  const accType = info.acc_type === undefined ? 0 : Number(info.acc_type);
  if (accType !== 1) {
    return 0n;
  }

  const eccNano = extractCurrencyNano(info.currencies, currencyId);
  return BigInt(String(eccNano || "0"));
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
export async function getAccountPublicKey(address: any) {
  const accountQuery = `
    query getAccount($address: String!) {
      blockchain {
        account(address: $address) {
          info {
            balance(format: DEC)
            address
            acc_type
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

    // Audit #2: prefer numeric acc_type (1=Active) with _name fallback
    const isActive = info.acc_type === 1 || String(info.acc_type_name || "").toLowerCase() === "active";
    if (!isActive) {
      return {
        isDeployed: false,
        balance: nanoToDecimal(info.balance || "0"),
        reason: `Account status is "${info.acc_type_name || info.acc_type}", not Active.`,
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
        const walletAbiPath = path.join(__dirname, "../abi/UpdateCustodianMultisigWallet.abi.json");
        const walletAbi = JSON.parse(fs.readFileSync(walletAbiPath, "utf-8"));
        
        const runRes = await sdkClient.tvm.run_tvm({
          message: (await sdkClient.boc.encode_boc({ builder: [] })).boc,
          account: info.boc,
          abi: abiContract(walletAbi),
          function_name: "getCustodians",
          return_updated_account: false
        });
        
        if (runRes && runRes.decoded && runRes.decoded.output && runRes.decoded.output.custodians) {
          const custodians = runRes.decoded.output.custodians;
          if (custodians.length > 0 && custodians[0].owner_pubkey) {
            publicKey = String(BigInt(custodians[0].owner_pubkey).toString(16)).padStart(64, '0');
          }
        }
      } catch (e) {
        // preserve undefined or extracted pubkey, do not overwrite to ""
      }
    }

    return {
      isDeployed: true,
      balance: nanoToDecimal(info.balance || "0"),
      publicKey,
      codeHash: info.code_hash || "",
      boc: info.boc || "",
    };
  } catch (err: any) {
    const errMsg = String(err.message || "");
    // SEC-05: Propagate network/timeout errors instead of masking as "not deployed".
    // Without this, a temporary API outage silently blocks ALL logins.
    if (errMsg.includes("Network") || errMsg.includes("timeout") || errMsg.includes("ECONNREFUSED") || errMsg.includes("ETIMEDOUT") || errMsg.includes("ENOTFOUND")) {
      console.error(`[GraphQL] getAccountPublicKey network error for ${address}:`, errMsg);
      throw new Error(`Falha de rede ao consultar a blockchain para ${address}. Tente novamente em instantes.`);
    }
    // Non-network errors (e.g., malformed response) still return gracefully
    console.warn(`[GraphQL] getAccountPublicKey non-network error for ${address}:`, errMsg);
    return { isDeployed: false };
  }
}

/**
 * Busca apenas o estado da conta (boc) sem verificações de Auth rigorosas.
 * Útil para o serviço de sync ler dados on-chain de contratos inativos ou recém-criados.
 */
export async function getAccountState(address: any) {
  const accountQuery = `
    query getAccount($address: String!) {
      blockchain {
        account(address: $address) {
          info {
            acc_type
            boc
          }
        }
      }
    }
  `;

  try {
    const data = await gql(accountQuery, { address });
    const info = data?.blockchain?.account?.info;

    if (!info || info.acc_type !== 1) {
      return { isDeployed: false, boc: "" };
    }

    return {
      isDeployed: true,
      boc: info.boc || "",
    };
  } catch (err: any) {
    if (err.message && (err.message.includes("timeout") || err.message.includes("Network") || err.message.includes("ECONNREFUSED"))) {
      throw err;
    }
    return { isDeployed: false, boc: "" };
  }
}

/**
 * Busca transações recentes na BondingCurve para indexar Trades (Buy/Sell)
 */
export async function getRecentBondingCurveTrades(address: any, afterCursor: string | null = null) {
  const query = `
    query getTrades($address: String!, $after: String) {
      blockchain {
        account(address: $address) {
          transactions(first: 20, after: $after) {
            pageInfo {
              endCursor
              hasNextPage
            }
            edges {
              node {
                id
                now
                out_messages {
                  id
                  body
                  msg_type_name
                }
              }
            }
          }
        }
      }
    }
  `;
  try {
    const data = await gql(query, { address, after: afterCursor });
    const connection = data?.blockchain?.account?.transactions;
    const edges = connection?.edges || [];
    const pageInfo = connection?.pageInfo || {};
    const trades = [];
    
    for (const edge of edges) {
      const tx = edge.node;
      const outMsgs = tx.out_messages || [];
      for (const msg of outMsgs) {
        if (msg.msg_type_name === "extOut" && msg.body && isWasmDecoderAvailable()) {
          try {
            const decodedBuy = tvmClient.decodeEvent(msg.body, BONDING_CURVE_ABI, "TokensPurchaseInitiated");
            if (decodedBuy) {
              trades.push({
                txHash: `${tx.id}_${msg.id}`,
                walletAddress: normalizeAddress(decodedBuy.buyer),
                type: "buy",
                tokenAmount: String(decodedBuy.tokensOut),
                shellAmount: String(decodedBuy.shellIn),
                price: Number(decodedBuy.tokensOut) > 0 ? Number(decodedBuy.shellIn) / Number(decodedBuy.tokensOut) : 0,
                createdAt: new Date(tx.now * 1000).toISOString()
              });
              continue;
            }
          } catch (e) {
            // not a buy event
          }
          
          try {
            const decodedSell = tvmClient.decodeEvent(msg.body, BONDING_CURVE_ABI, "TokensSold");
            if (decodedSell) {
              trades.push({
                txHash: `${tx.id}_${msg.id}`,
                walletAddress: normalizeAddress(decodedSell.seller),
                type: "sell",
                tokenAmount: String(decodedSell.tokensIn),
                shellAmount: String(decodedSell.shellOut),
                price: Number(decodedSell.tokensIn) > 0 ? Number(decodedSell.shellOut) / Number(decodedSell.tokensIn) : 0,
                createdAt: new Date(tx.now * 1000).toISOString()
              });
            }
          } catch (e) {
             // not a sell event
          }
        }
      }
    }
    return { trades, pageInfo };
  } catch (err: any) {
    console.error(`[GraphQL] Error fetching trades for ${address}:`, err.message);
    return { trades: [], pageInfo: {} };
  }
}


