const fs = require("fs");
const path = require("path");
const { config } = require("../config");

/**
 * deployer.service.js
 *
 * Serviço de deploy dos contratos TokenRoot e BondingCurve na Acki Nacki.
 *
 * ESTADO ATUAL:
 * O deploy on-chain real via TVM SDK está preparado mas requer:
 *   1. DEPLOYER_PRIVATE_KEY configurada no .env
 *   2. TVM SDK library (libNode) carregada
 *   3. Arquivos ABI e TVC compilados em src/abi/
 *   4. Descomentariar o process_message para enviar à rede
 *
 * Até que todos os requisitos sejam atendidos, o serviço retorna
 * status honesto indicando que o deploy está pendente de configuração.
 */

let client = null;
let sdkAvailable = false;

try {
  const { TvmClient } = require("@tvmsdk/core");
  const { libNode } = require("@tvmsdk/lib-node");

  TvmClient.useBinaryLibrary(libNode);
  client = new TvmClient({
    network: {
      endpoints: [config.graphqlUrl || "https://shellnet.ackinacki.org/graphql"],
    },
  });
  sdkAvailable = true;
  console.log("[Deployer] TVM SDK Library carregada (libNode).");
} catch (e) {
  console.warn("[Deployer] TVM SDK indisponível. Deploy on-chain não será possível.", e.message);
}

/**
 * Executa o deploy dos contratos ou retorna status honesto se não for possível.
 *
 * NUNCA retorna status "deployed" se a transação não foi realmente enviada à rede.
 */
async function deployTokenEcosystem({ name, symbol, totalSupply, ipfsHash, creatorWallet }) {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

  // ── Verificação 1: Private key configurada? ────────────────────────────────
  if (!privateKey || privateKey.includes("CONFIGURE") || privateKey.includes("your_")) {
    console.warn("[Deployer] DEPLOYER_PRIVATE_KEY não configurada. Deploy on-chain indisponível.");
    return {
      tokenRoot: "",
      bondingCurve: "",
      status: "pending_deployer_configuration",
      reason: "DEPLOYER_PRIVATE_KEY não configurada no backend. Configure o .env para habilitar deploy on-chain.",
    };
  }

  // ── Verificação 2: TVM SDK disponível? ─────────────────────────────────────
  if (!sdkAvailable || !client) {
    console.warn("[Deployer] TVM SDK indisponível. Deploy on-chain não possível.");
    return {
      tokenRoot: "",
      bondingCurve: "",
      status: "pending_sdk_configuration",
      reason: "TVM SDK (libNode) não carregou. Verifique as dependências do backend.",
    };
  }

  // ── Verificação 3: Arquivos ABI/TVC existem? ───────────────────────────────
  const abiPath = path.join(__dirname, "../abi/TokenRoot.abi.json");
  const tvcPath = path.join(__dirname, "../abi/TokenRoot.tvc");

  if (!fs.existsSync(abiPath) || !fs.existsSync(tvcPath)) {
    console.warn("[Deployer] Arquivos compilados do contrato não encontrados em src/abi/.");
    return {
      tokenRoot: "",
      bondingCurve: "",
      status: "pending_contract_compilation",
      reason: "Arquivos ABI/TVC do TokenRoot não encontrados na pasta src/abi/.",
    };
  }

  // ── Tentativa de deploy real ───────────────────────────────────────────────
  try {
    const { abiContract, signerKeys } = require("@tvmsdk/core");

    const signer = signerKeys({
      keys: {
        public: "",  // SDK pode derivar da secret
        secret: privateKey,
      }
    });

    console.log(`[Deployer] Preparando deploy para: ${name} (${symbol})`);

    const tokenRootAbi = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
    const tokenRootTvc = fs.readFileSync(tvcPath, "base64");

    const deployParams = {
      abi: abiContract(tokenRootAbi),
      deploy_set: {
        tvc: tokenRootTvc,
        initial_data: { _nonce: Math.floor(Math.random() * 1000000) }
      },
      call_set: {
        function_name: "constructor",
        input: {
          initialSupplyTo: creatorWallet,
          initialSupply: totalSupply,
          deployWalletValue: "100000000",
          name: name,
          symbol: symbol,
          decimals: 9
        }
      },
      signer
    };

    // Calcular endereço predito
    const { address: rootAddress } = await client.abi.encode_message(deployParams);

    // ── DEPLOY REAL: Descomentar quando pronto para produção ─────────────────
    // IMPORTANTE: Antes de descomentar, teste na testnet extensivamente.
    //
    // await client.processing.process_message({
    //   message_encode_params: deployParams,
    //   send_events: false
    // });

    console.log(`[Deployer] TokenRoot endereço predito: ${rootAddress}`);
    console.log(`[Deployer] NOTA: process_message ainda comentado. Token NÃO foi deployado.`);

    // Retorna status HONESTO — endereço predito, mas não deployado
    return {
      tokenRoot: rootAddress,
      bondingCurve: "",
      status: "awaiting_chain_integration",
      reason: "Endereço do contrato calculado, mas o envio à blockchain (process_message) ainda não está habilitado. "
            + "Habilite no deployer.service.js quando pronto para produção.",
    };
  } catch (error) {
    console.error("[Deployer] Erro na preparação do deploy:", error.message);
    return {
      tokenRoot: "",
      bondingCurve: "",
      status: "deploy_error",
      reason: `Erro ao preparar deploy: ${error.message}`,
    };
  }
}

module.exports = {
  deployTokenEcosystem
};
