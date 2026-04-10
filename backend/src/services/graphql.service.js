/**
 * graphql.service.js
 *
 * Integração com a GraphQL API da Acki Nacki.
 *
 * Endpoint público (testnet): https://shellnet.ackinacki.org/graphql
 * Documentação: https://dev.ackinacki.com/graphql/graphql-api
 *
 * O schema usa a raiz `blockchain { ... }` com paginação Relay Cursor.
 * Não existe query `transaction(hash:)` direta — buscamos via
 * `blockchain { transactions(filter: { hash: { eq: $hash } }) { edges { node { ... } } } }`
 */

const axios = require("axios");
const { config } = require("../config");

const GRAPHQL_ENDPOINT = config.graphqlUrl || "https://shellnet.ackinacki.org/graphql";

/**
 * Executa uma query GraphQL contra o endpoint da Acki Nacki.
 */
async function gql(query, variables = {}) {
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
}

/**
 * Busca uma transação pelo hash.
 *
 * A API da Acki Nacki não expõe `transaction(hash:)` diretamente.
 * Usamos `blockchain.transactions` com filtro de hash e pegamos o
 * primeiro resultado (hash é único por definição).
 *
 * Retorna null se não encontrada.
 *
 * Campos mapeados para o contrato interno do AckiMeme:
 *   tx.hash      — hash da transação
 *   tx.account_addr — endereço de destino (feeWallet)
 *   tx.in_msg    — mensagem de entrada (contém src, value, body)
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
        transactions(
          filter: { hash: { eq: $hash } }
          first: 1
        ) {
          edges {
            node {
              hash
              account_addr
              status
              status_name
              tr_type
              tr_type_name
              balance_delta(format: DEC)
              in_msg {
                src
                dst
                value(format: DEC)
                msg_type
                msg_type_name
                body
              }
            }
          }
        }
      }
    }
  `;

  const data = await gql(query, { hash });
  const edges = data?.blockchain?.transactions?.edges;

  if (!edges || edges.length === 0) {
    return null;
  }

  const node = edges[0].node;

  /**
   * Normaliza para o formato que payments.js espera:
   *   { hash, from, to, amount, token: { symbol }, status }
   *
   * Na Acki Nacki:
   *   - `from`   = in_msg.src  (quem enviou)
   *   - `to`     = account_addr ou in_msg.dst  (quem recebeu)
   *   - `amount` = in_msg.value em nanotokens
   *   - status   = "SUCCESS" quando status_name === "Finalized"
   *
   * O token nativo é SHELL (VMSHELL). Transações de USDC precisarão
   * de leitura adicional do body/ABI quando integração TIP-3 estiver pronta.
   */
  return {
    hash: node.hash,
    from: node.in_msg?.src || "",
    to: node.account_addr || node.in_msg?.dst || "",
    amount: nanoToDecimal(node.in_msg?.value || "0"),
    token: {
      symbol: "SHELL", // token nativo; substituir por leitura TIP-3 quando disponível
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

module.exports = {
  getTransaction,
  getAccountBalance,
  nanoToDecimal,
};
