const axios = require("axios");

/**
 * ipfs.service.js
 * 
 * Este serviço lida com o upload de metadados do token (JSON) e imagens
 * para o IPFS usando o Pinata. 
 * 
 * Necessário configurar no .env:
 * PINATA_API_KEY=...
 * PINATA_SECRET_API_KEY=...
 */

const PINATA_API_KEY = process.env.PINATA_API_KEY || "";
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_API_KEY || "";

/**
 * Faz o upload de um objeto JSON (metadados do token) para o IPFS.
 * Retorna o CID (hash) do conteúdo.
 */
async function uploadToIPFS(metadata) {
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Falha Crítica: PINATA_API_KEY ou PINATA_SECRET_API_KEY não configuradas em ambiente de produção.");
    }
    console.warn("[IPFS] PINATA keys não configuradas. Usando mock hash.");
    return "QmMockHashForMetadata" + Math.floor(Math.random() * 1000000);
  }

  try {
    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        pinataContent: metadata,
        pinataMetadata: {
          name: `metadata_${metadata.symbol || "unknown"}.json`,
        },
      },
      {
        headers: {
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_KEY,
        },
      }
    );

    return response.data.IpfsHash;
  } catch (error) {
    console.error("[IPFS] Erro ao subir para o Pinata:", error.response?.data || error.message);
    throw new Error("Falha ao descentralizar metadados no IPFS.");
  }
}

/**
 * Estrutura os metadados no padrão TEP-74 / TIP-3 compatibility
 */
function createTokenMetadata(launchRequest) {
  return {
    name: launchRequest.coin.name,
    symbol: launchRequest.coin.symbol,
    description: launchRequest.coin.description,
    image: launchRequest.coin.logoUrl || "",
    external_url: launchRequest.links.website || "",
    attributes: [
      { trait_type: "Platform", value: "AckiMeme" },
      { trait_type: "LaunchMode", value: "Bonding Curve" },
      { trait_type: "Creator", value: launchRequest.creator.wallet }
    ]
  };
}

module.exports = {
  uploadToIPFS,
  createTokenMetadata
};
