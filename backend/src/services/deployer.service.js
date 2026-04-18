const fs = require("fs");
const path = require("path");
const { config } = require("../config");
const { getAccountPublicKey } = require("./graphql.service");

/**
 * deployer.service.js
 *
 * Serviço de deploy dos contratos TokenRoot e BondingCurve na Acki Nacki.
 *
 * FLUXO:
 *   1. Verifica pré-requisitos (private key, SDK, arquivos ABI/TVC)
 *   2. Deploya o contrato TokenRoot com supply, nome, símbolo e decimais
 *   3. Deploya o contrato BondingCurve vinculado ao TokenRoot
 *   4. Transfere ownership do TokenRoot para o BondingCurve
 *
 * CONTROLE DE DEPLOY:
 *   - A variável ENABLE_ONCHAIN_DEPLOY no .env controla se o deploy real é executado
 *   - Quando false (ou ausente), o sistema calcula endereços preditos sem enviar à rede
 *   - Quando true, o process_message é chamado para deploy real
 *
 * Ref: https://dev.ackinacki.com/acki-nacki-sdk/quick-start-tvm-sdk-javascript
 * SDK: https://github.com/tvmlabs/tvm-sdk
 */

const ABI_DIR = path.join(__dirname, "../abi");

// Flag de controle — habilita envio real à blockchain
const ENABLE_ONCHAIN_DEPLOY = process.env.ENABLE_ONCHAIN_DEPLOY === "true";

let client = null;
let sdkAvailable = false;
let abiContract = null;
let signerKeys = null;

try {
  const tvmCore = require("@tvmsdk/core");
  const { libNode } = require("@tvmsdk/lib-node");

  tvmCore.TvmClient.useBinaryLibrary(libNode);
  client = new tvmCore.TvmClient({
    network: {
      endpoints: [config.graphqlUrl || "https://shellnet.ackinacki.org/graphql"],
    },
  });
  abiContract = tvmCore.abiContract;
  signerKeys = tvmCore.signerKeys;
  sdkAvailable = true;
  console.log("[Deployer] TVM SDK Library carregada (libNode).");
} catch (e) {
  console.warn("[Deployer] TVM SDK indisponível. Deploy on-chain não será possível.", e.message);
}

/**
 * Verifica se os arquivos compilados de um contrato existem.
 */
function contractFilesExist(contractName) {
  const abiPath = path.join(ABI_DIR, `${contractName}.abi.json`);
  const tvcPath = path.join(ABI_DIR, `${contractName}.tvc`);
  return fs.existsSync(abiPath) && fs.existsSync(tvcPath);
}

/**
 * Carrega ABI e TVC de um contrato.
 */
function loadContractFiles(contractName) {
  const abiPath = path.join(ABI_DIR, `${contractName}.abi.json`);
  const tvcPath = path.join(ABI_DIR, `${contractName}.tvc`);
  return {
    abi: JSON.parse(fs.readFileSync(abiPath, "utf-8")),
    tvc: fs.readFileSync(tvcPath).toString("base64"),
  };
}

/**
 * Prepara os parâmetros de deploy e opcionalmente executa o deploy.
 * Retorna o endereço do contrato (predito ou real).
 */
async function deployContract({ contractName, constructorInput, initialData, signer, label }) {
  const { abi, tvc } = loadContractFiles(contractName);

  const deployParams = {
    abi: abiContract(abi),
    deploy_set: {
      tvc,
      initial_data: initialData || {},
    },
    call_set: {
      function_name: "constructor",
      input: constructorInput,
    },
    signer,
  };

  // Calcular endereço predito
  const { address } = await client.abi.encode_message(deployParams);

  if (ENABLE_ONCHAIN_DEPLOY) {
    console.log(`[Deployer] ${label}: Enviando deploy para a blockchain...`);
    await client.processing.process_message({
      message_encode_params: deployParams,
      send_events: false,
    });
    console.log(`[Deployer] ${label}: Deploy confirmado! Endereço: ${address}`);
  } else {
    console.log(`[Deployer] ${label}: Endereço predito: ${address} (ENABLE_ONCHAIN_DEPLOY=false)`);
  }

  return address;
}

/**
 * Executa o deploy completo: TokenRoot + BondingCurve.
 *
 * NUNCA retorna status "deployed" se a transação não foi realmente enviada à rede.
 */
async function deployTokenEcosystem({ name, symbol, totalSupply, ipfsHash, creatorWallet, paymentTxHash }) {
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
  if (!contractFilesExist("TokenRoot") || !contractFilesExist("TokenWallet")) {
    console.warn("[Deployer] Arquivos compilados do TokenRoot ou TokenWallet não encontrados.");
    return {
      tokenRoot: "",
      bondingCurve: "",
      status: "pending_contract_compilation",
      reason: "Arquivos ABI/TVC do TokenRoot ou TokenWallet não encontrados na pasta src/abi/.",
    };
  }

  if (!contractFilesExist("BondingCurve")) {
    console.warn("[Deployer] Arquivos compilados do BondingCurve não encontrados.");
    return {
      tokenRoot: "",
      bondingCurve: "",
      status: "pending_contract_compilation",
      reason: "Arquivos ABI/TVC do BondingCurve não encontrados na pasta src/abi/.",
    };
  }

  // ── Tentativa de deploy ────────────────────────────────────────────────────
  try {
    // C-06: Use nacl_sign_keypair_from_seed for 32-byte Ed25519 seeds
    // nacl_sign_keypair_from_secret_key expects 64-byte secret (seed+pubkey concatenated)
    // but DEPLOYER_PRIVATE_KEY is a 32-byte seed (64 hex chars)
    const keyPair = await client.crypto.nacl_sign_keypair_from_seed({
      seed: privateKey,
    });

    const signer = signerKeys({
      keys: {
        public: keyPair.public,
        secret: keyPair.secret,
      },
    });

    console.log(`[Deployer] Preparando deploy para: ${name} (${symbol})`);

    // ── Passo 1: Deploy do TokenRoot ───────────────────────────────────────
    // O TokenRoot precisa do walletCode (TVC do TokenWallet) para deployar wallets
    const walletTvc = loadContractFiles("TokenWallet").tvc;

    const tokenRootAddress = await deployContract({
      contractName: "TokenRoot",
      constructorInput: {
        _name: name,
        _symbol: symbol,
        _decimals: 9,
        _walletCode: walletTvc,
        _owner: creatorWallet,
        _shellToConvert: 5000000000 // 5 SHELL for VMSHELL conversion upon external deploy
      },
      initialData: {},
      signer,
      label: "TokenRoot",
    });

    // ── Passo 2: Predizer/Deploy do BondingCurve (Mensagem Interna) ────────
    const { abi: bcAbi, tvc: bcTvc } = loadContractFiles("BondingCurve");
    // C-05: Include _tokenRoot in initial_data for unique BondingCurve addresses
    // Without this, all BondingCurves would hash to the same address
    const { address: bondingCurveAddress } = await client.abi.encode_message({
      abi: abiContract(bcAbi),
      deploy_set: { tvc: bcTvc, initial_data: { _tokenRoot: tokenRootAddress } },
      call_set: {
        function_name: "constructor",
        input: {
          _owner: creatorWallet,
          _tokenRoot: tokenRootAddress,
          _name: name,
          _symbol: symbol,
          _creationFeeTxHash: Buffer.from(paymentTxHash || "genesis").toString("hex")
        }
      },
      signer
    });

    if (ENABLE_ONCHAIN_DEPLOY) {
      console.log(`[Deployer] Atualizando TokenRoot com BondingCurve code e deployando (DappID)...`);
      const trAbi = loadContractFiles("TokenRoot").abi;

      await client.processing.process_message({
        message_encode_params: {
          address: tokenRootAddress,
          abi: abiContract(trAbi),
          call_set: { function_name: "setBondingCurveCode", input: { _code: bcTvc } },
          signer
        },
        send_events: false
      });

      await client.processing.process_message({
        message_encode_params: {
          address: tokenRootAddress,
          abi: abiContract(trAbi),
          call_set: {
            function_name: "deployBondingCurve",
            input: {
              _owner: creatorWallet,
              _name: name,
              _symbol: symbol,
              _creationFeeTxHash: Buffer.from(paymentTxHash || "genesis").toString("hex"),
              _initialBalance: 10000000000 // 10 VMSHELL to inner BondingCurve
            }
          },
          signer
        },
        send_events: false
      });
      console.log(`[Deployer] Mensagem interna disparada. Aguardando deploy on-chain do BondingCurve...`);
      
      // Wait for deployment
      let isDeployed = false;
      for (let i = 0; i < 15; i++) {
        await new Promise((res) => setTimeout(res, 2000));
        const pubKey = await getAccountPublicKey(bondingCurveAddress);
        if (pubKey.isDeployed) {
           isDeployed = true;
           break;
        }
      }
      
      if (!isDeployed) {
        throw new Error("Timeout aguardando deploy do BondingCurve. Verifique se o TokenRoot possuía gás suficiente.");
      }
      console.log(`[Deployer] BondingCurve deployado com sucesso via mensagem interna no DappID!`);
    }

    // Determinar status baseado no flag de deploy
    const deployStatus = ENABLE_ONCHAIN_DEPLOY ? "deployed" : "awaiting_chain_integration";
    const reason = ENABLE_ONCHAIN_DEPLOY
      ? ""
      : "Endereços dos contratos calculados, mas ENABLE_ONCHAIN_DEPLOY=false. "
        + "Defina ENABLE_ONCHAIN_DEPLOY=true no .env quando pronto para produção.";

    console.log(`[Deployer] TokenRoot: ${tokenRootAddress}`);
    console.log(`[Deployer] BondingCurve: ${bondingCurveAddress}`);
    console.log(`[Deployer] Status: ${deployStatus}`);

    return {
      tokenRoot: tokenRootAddress,
      bondingCurve: bondingCurveAddress,
      status: deployStatus,
      reason,
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
  deployTokenEcosystem,
};
