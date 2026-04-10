const crypto = require("crypto");
const { config } = require("./config");

async function graphqlQuery(query, variables = {}) {
  const endpoint = config.tvmEndpoints ? config.tvmEndpoints[0] : "https://shellnet.ackinacki.org/graphql";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal
    });
    
    if (!response.ok) {
      throw new Error(`GraphQL Error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    if (result.errors) {
      throw new Error(result.errors[0].message);
    }
    return result.data;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Consulta on-chain para verificar se a carteira está de fato implantada
 * na blockchain Acki Nacki, como parte da "prova forte" pedida.
 */
async function getAccountPublicKey(address) {
  const query = `
    query getAccount($address: String!) {
      accounts(filter: { id: { eq: $address } }) {
        id
        balance
        code_hash
      }
    }
  `;
  const data = await graphqlQuery(query, { address });
  
  if (!data.accounts || data.accounts.length === 0) {
    return { isDeployed: false };
  }

  return {
    isDeployed: true,
    balance: data.accounts[0].balance
  };
}

// Vamos re-exportar a verificação ED25519 usando node nativo (já que é igual).
module.exports = {
  getAccountPublicKey
};
