import axios from "axios";

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
export async function uploadToIPFS(metadata: any): Promise<string> {
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "FATAL: PINATA_API_KEY ou PINATA_SECRET_API_KEY não configuradas. " +
        "Upload de metadados para IPFS é obrigatório em produção. " +
        "Configure essas variáveis no .env antes de aceitar pagamentos."
      );
    }
    console.warn(
      "[IPFS] ⚠️  PINATA keys não configuradas. Usando hash de desenvolvimento. " +
      "NÃO use este ambiente para processar tokens reais."
    );
    // Hash claramente identificável como mock — NUNCA confundir com IPFS real
    return `DEV_MOCK_NOT_REAL_IPFS_${Date.now()}`;
  }

  let attempt = 0;
  const maxAttempts = 3;
  while (attempt < maxAttempts) {
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
          timeout: 20000,
        }
      );

      return response.data.IpfsHash;
    } catch (error: any) {
      attempt++;
      console.error(`[IPFS] Erro ao subir para o Pinata (Tentativa ${attempt}/${maxAttempts}):`, error.response?.data || error.message);
      if (attempt >= maxAttempts) {
        throw new Error("Falha ao descentralizar metadados no IPFS após múltiplas tentativas.");
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // exp backoff: 1s, 2s
    }
  }
}

/**
 * Estrutura os metadados no padrão TEP-74 / TIP-3 compatibility
 */
export function createTokenMetadata(launchRequest: any) {
  const attributes = [
    { trait_type: "Platform", value: "AckiMeme" },
    { trait_type: "LaunchMode", value: "Bonding Curve" },
  ];

  if (launchRequest.protocol?.pumpForever) {
    attributes.push({ trait_type: "PumpForever", value: "Yes" });
  }

  return {
    name: launchRequest.coin.name,
    symbol: launchRequest.coin.symbol,
    description: launchRequest.coin.description,
    image: launchRequest.coin.logoUrl || "",
    external_url: launchRequest.links.website || "",
    decimals: 9,
    version: "0.4.0",
    attributes,
  };
}


