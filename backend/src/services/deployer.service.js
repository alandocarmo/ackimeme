const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { config } = require("../config");
const { getAccountPublicKey, getAccountBalanceNano, getAccountState } = require("./graphql.service");

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
const TOKEN_DECIMALS = 9;
const SHELL_CURRENCY_ID = 2;
const DEFAULT_DEPLOY_PREFUND_SHELL_NANO = "10000000000"; // 10 SHELL ECC
const DEFAULT_DEPLOY_PREFUND_MESSAGE_VALUE_NANO = "0";
const DEFAULT_DEPLOY_FUNDING_ATTEMPTS = 40;
const DEFAULT_BONDING_CURVE_DEPLOY_ATTEMPTS = 200;

let client = null;
let sdkAvailable = false;
let abiContract = null;
let signerKeys = null;

const { getTvmClient, getTvmCore, sdkAvailable: isTvmSdkAvailable } = require("./tvm-client");

if (isTvmSdkAvailable) {
  const core = getTvmCore();
  client = getTvmClient();
  abiContract = core.abiContract;
  signerKeys = core.signerKeys;
  sdkAvailable = true;
  console.log("[Deployer] TVM SDK Library carregada (via tvm-client singleton).");
} else {
  console.warn("[Deployer] TVM SDK indisponível. Deploy on-chain não será possível.");
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

function parseTokenSupplyToNano(totalSupply, decimals = TOKEN_DECIMALS) {
  const digits = String(totalSupply || "").trim().replace(/[.,]/g, "");
  if (!/^\d+$/.test(digits) || digits === "0") {
    throw new Error("totalSupply inválido para deploy on-chain.");
  }
  return (BigInt(digits) * (10n ** BigInt(decimals))).toString();
}

function buildDeployNonce({ creatorWallet, symbol, paymentTxHash }) {
  const input = [
    "ackimeme-token-root-v1",
    String(creatorWallet || "").toLowerCase(),
    String(symbol || "").toUpperCase(),
    String(paymentTxHash || "").toLowerCase(),
  ].join(":");
  const digest = crypto.createHash("sha256").update(input).digest("hex");
  return BigInt(`0x${digest}`).toString();
}

function normalizeHex(value) {
  return String(value || "").trim().replace(/^0x/i, "");
}

function isPlaceholder(value) {
  return !value || value.includes("CONFIGURE") || value.includes("your_") || value.includes("YOUR_");
}

function getPositiveIntegerEnv(name, fallback) {
  const value = String(process.env[name] || fallback).trim();
  if (!/^\d+$/.test(value) || BigInt(value) <= 0n) {
    throw new Error(`${name} deve ser um inteiro positivo em nano units.`);
  }
  return value;
}

function getNonNegativeIntegerEnv(name, fallback) {
  const value = String(process.env[name] || fallback).trim();
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} deve ser um inteiro não negativo em nano units.`);
  }
  return value;
}

function loadDeployerKeyConfig() {
  let fileKeys = {};
  const keyFile = String(process.env.DEPLOYER_KEYS_FILE || "").trim();
  if (keyFile && !isPlaceholder(keyFile)) {
    if (!fs.existsSync(keyFile)) {
      return { configured: false, usable: false, reason: `DEPLOYER_KEYS_FILE não encontrado: ${keyFile}` };
    }
    try {
      fileKeys = JSON.parse(fs.readFileSync(keyFile, "utf-8"));
    } catch (err) {
      return { configured: true, usable: false, reason: `DEPLOYER_KEYS_FILE inválido: ${err.message}` };
    }
  }

  const publicKey = normalizeHex(fileKeys.public || fileKeys.publicKey || process.env.DEPLOYER_PUBLIC_KEY);
  const secretKey = normalizeHex(
    fileKeys.secret ||
      fileKeys.secretKey ||
      process.env.DEPLOYER_SECRET_KEY ||
      process.env.DEPLOYER_PRIVATE_KEY,
  );

  if (isPlaceholder(secretKey)) {
    return { configured: false, usable: false, reason: "DEPLOYER_SECRET_KEY não configurada." };
  }

  if (!/^[0-9a-f]+$/i.test(secretKey)) {
    return { configured: true, usable: false, reason: "DEPLOYER_SECRET_KEY deve estar em hexadecimal." };
  }

  if (secretKey.length !== 64 && secretKey.length !== 128) {
    return {
      configured: true,
      usable: false,
      reason:
        "DEPLOYER_SECRET_KEY deve ter 32 bytes/64 hex para nacl_sign_keypair_from_secret_key " +
        "ou 64 bytes/128 hex no formato signer secret completo.",
    };
  }

  if (publicKey && !/^[0-9a-f]{64}$/i.test(publicKey)) {
    return {
      configured: true,
      usable: false,
      reason: "DEPLOYER_PUBLIC_KEY deve ter 32 bytes/64 caracteres hex.",
    };
  }

  return {
    configured: true,
    usable: true,
    publicKey,
    secretKey,
    secretFormat: secretKey.length === 64 ? "raw_secret" : "signer_secret",
  };
}

async function resolveDeployerKeyPair() {
  const keyConfig = loadDeployerKeyConfig();
  if (!keyConfig.usable) {
    throw new Error(keyConfig.reason);
  }

  const keyPair =
    keyConfig.secretFormat === "raw_secret"
      ? await client.crypto.nacl_sign_keypair_from_secret_key({
          secret: keyConfig.secretKey,
        })
      : {
          public: keyConfig.secretKey.slice(64),
          secret: keyConfig.secretKey,
        };

  if (
    keyConfig.publicKey &&
    String(keyPair.public).toLowerCase() !== String(keyConfig.publicKey).toLowerCase()
  ) {
    throw new Error("DEPLOYER_PUBLIC_KEY não corresponde à DEPLOYER_SECRET_KEY configurada.");
  }

  return {
    public: keyConfig.publicKey || keyPair.public,
    secret: keyConfig.secretKey,
  };
}

// Removida: getAccountBalanceNano via query_collection foi migrada para graphql.service.js

async function waitForFutureAddressFunding(address, minBalanceNano) {
  const attempts = Number(process.env.DEPLOY_FUNDING_CONFIRM_ATTEMPTS || DEFAULT_DEPLOY_FUNDING_ATTEMPTS);
  for (let i = 0; i < attempts; i += 1) {
    const balanceNano = await getAccountBalanceNano(address);
    if (balanceNano >= BigInt(minBalanceNano)) {
      return true;
    }
    await new Promise((res) => setTimeout(res, 3000));
  }
  return false;
}

async function buildEmptyPayloadCell() {
  const { boc } = await client.boc.encode_boc({ builder: [] });
  return boc;
}

async function prefundFutureContractAddress(address, signer, onChainAttempt) {
  const walletAddress = String(process.env.DEPLOYER_WALLET_ADDRESS || "").trim();
  if (!walletAddress || isPlaceholder(walletAddress)) {
    throw new Error("DEPLOYER_WALLET_ADDRESS deve apontar para a wallet/multisig financiadora do deployer.");
  }

  const prefundShellNano = getPositiveIntegerEnv(
    "DEPLOYER_PREFUND_SHELL_NANO",
    DEFAULT_DEPLOY_PREFUND_SHELL_NANO,
  );
  const messageValueNano = getNonNegativeIntegerEnv(
    "DEPLOYER_PREFUND_MESSAGE_VALUE_NANO",
    DEFAULT_DEPLOY_PREFUND_MESSAGE_VALUE_NANO,
  );
  const walletAbi = loadContractFiles("UpdateCustodianMultisigWallet").abi;
  const payload = await buildEmptyPayloadCell();

  console.log(
    `[Deployer] Pré-financiando endereço futuro ${address} com ${prefundShellNano} nanoSHELL ECC...`,
  );
  if (typeof onChainAttempt === "function") {
    onChainAttempt();
  }

  await client.processing.process_message({
    message_encode_params: {
      address: walletAddress,
      abi: abiContract(walletAbi),
      call_set: {
        function_name: "sendTransaction",
        input: {
          dest: address,
          value: messageValueNano,
          cc: { [SHELL_CURRENCY_ID]: prefundShellNano },
          bounce: false,
          flags: 1,
          payload,
        },
      },
      signer,
    },
    send_events: false,
  });

  const funded = await waitForFutureAddressFunding(address, prefundShellNano);
  if (!funded) {
    throw new Error(
      `Timeout aguardando pré-financiamento do endereço futuro ${address}. ` +
        "A transação de funding foi enviada; verifique a wallet financiadora e o GraphQL.",
    );
  }
}

function getDeployerReadiness() {
  const keyConfig = loadDeployerKeyConfig();
  const fundingWallet = String(process.env.DEPLOYER_WALLET_ADDRESS || "").trim();
  const fundingWalletConfigured = Boolean(fundingWallet) && !isPlaceholder(fundingWallet);

  return {
    enabled: ENABLE_ONCHAIN_DEPLOY,
    sdkAvailable: Boolean(sdkAvailable && client),
    privateKeyConfigured: Boolean(keyConfig.usable),
    keyPairConfigured: Boolean(keyConfig.usable),
    keyPairReason: keyConfig.usable ? "" : keyConfig.reason,
    fundingWalletConfigured,
    contractsCompiled:
      contractFilesExist("TokenRoot") &&
      contractFilesExist("TokenWallet") &&
      contractFilesExist("BondingCurve") &&
      contractFilesExist("UpdateCustodianMultisigWallet"),
  };
}

function assertOnchainDeployReady() {
  const readiness = getDeployerReadiness();
  if (!readiness.enabled) {
    return;
  }

  const missing = [];
  if (!readiness.sdkAvailable) missing.push("TVM SDK/lib-node");
  if (!readiness.keyPairConfigured) missing.push(`DEPLOYER_SECRET_KEY (${readiness.keyPairReason})`);
  if (!readiness.fundingWalletConfigured) missing.push("DEPLOYER_WALLET_ADDRESS");
  if (!readiness.contractsCompiled) missing.push("ABI/TVC dos contratos");

  if (missing.length > 0) {
    throw new Error(
      `Deploy on-chain habilitado, mas indisponível: ${missing.join(", ")}.`,
    );
  }
}

/**
 * Prepara os parâmetros de deploy e opcionalmente executa o deploy.
 * Retorna o endereço do contrato (predito ou real).
 */
async function deployContract({
  contractName,
  constructorInput,
  initialData,
  signer,
  label,
  onAddressPredicted,
  onChainAttempt,
}) {
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
  if (typeof onAddressPredicted === "function") {
    onAddressPredicted(address);
  }

  if (ENABLE_ONCHAIN_DEPLOY) {
    await prefundFutureContractAddress(address, signer, onChainAttempt);
    console.log(`[Deployer] ${label}: Enviando deploy para a blockchain...`);
    if (typeof onChainAttempt === "function") {
      onChainAttempt();
    }
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
async function deployTokenEcosystem({ name, symbol, totalSupply, ipfsHash, creatorWallet, paymentTxHash, pumpForever }) {
  let chainAttempted = false;
  let tokenRootAddress = "";
  let bondingCurveAddress = "";
  const markChainAttempted = () => {
    chainAttempted = true;
  };
  const maxTokenSupply = parseTokenSupplyToNano(totalSupply);
  const deployNonce = buildDeployNonce({ creatorWallet, symbol, paymentTxHash });
  const keyConfig = loadDeployerKeyConfig();

  // ── Verificação 1: Keypair configurado? ───────────────────────────────────
  if (!keyConfig.configured) {
    console.warn("[Deployer] DEPLOYER_SECRET_KEY não configurada. Deploy on-chain indisponível.");
    if (!ENABLE_ONCHAIN_DEPLOY) {
      return {
        tokenRoot: "",
        bondingCurve: "",
        status: "awaiting_chain_integration",
        chainAttempted,
        reason:
          "DEPLOYER_SECRET_KEY não configurada. Token registrado off-chain; " +
          "endereços on-chain serão calculados quando o deployer for configurado.",
      };
    }

    return {
      tokenRoot: "",
      bondingCurve: "",
      status: "pending_deployer_configuration",
      chainAttempted,
      reason: "DEPLOYER_SECRET_KEY não configurada no backend. Configure o .env para habilitar deploy on-chain.",
    };
  }

  if (!keyConfig.usable) {
    console.warn(`[Deployer] Keypair do deployer inválido: ${keyConfig.reason}`);
    return {
      tokenRoot: "",
      bondingCurve: "",
      status: "pending_deployer_configuration",
      chainAttempted,
      reason: keyConfig.reason,
    };
  }

  // ── Verificação 2: TVM SDK disponível? ─────────────────────────────────────
  if (!sdkAvailable || !client) {
    console.warn("[Deployer] TVM SDK indisponível. Deploy on-chain não possível.");
    return {
      tokenRoot: "",
      bondingCurve: "",
      status: "pending_sdk_configuration",
      chainAttempted,
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
      chainAttempted,
      reason: "Arquivos ABI/TVC do TokenRoot ou TokenWallet não encontrados na pasta src/abi/.",
    };
  }

  if (!contractFilesExist("BondingCurve")) {
    console.warn("[Deployer] Arquivos compilados do BondingCurve não encontrados.");
    return {
      tokenRoot: "",
      bondingCurve: "",
      status: "pending_contract_compilation",
      chainAttempted,
      reason: "Arquivos ABI/TVC do BondingCurve não encontrados na pasta src/abi/.",
    };
  }

  if (ENABLE_ONCHAIN_DEPLOY && !contractFilesExist("UpdateCustodianMultisigWallet")) {
    return {
      tokenRoot: "",
      bondingCurve: "",
      status: "pending_contract_compilation",
      chainAttempted,
      reason: "ABI/TVC da UpdateCustodianMultisigWallet não encontrados para pré-financiar deploy.",
    };
  }

  if (ENABLE_ONCHAIN_DEPLOY) {
    const fundingWallet = String(process.env.DEPLOYER_WALLET_ADDRESS || "").trim();
    if (!fundingWallet || isPlaceholder(fundingWallet)) {
      return {
        tokenRoot: "",
        bondingCurve: "",
        status: "pending_deployer_configuration",
        chainAttempted,
        reason: "DEPLOYER_WALLET_ADDRESS não configurado para pré-financiar endereços futuros.",
      };
    }
  }

  // ── Tentativa de deploy ────────────────────────────────────────────────────
  try {
    const keyPair = await resolveDeployerKeyPair();

    const signer = signerKeys({
      keys: {
        public: keyPair.public,
        secret: keyPair.secret,
      },
    });

    console.log(`[Deployer] Preparando deploy para: ${name} (${symbol})`);

    // ── Passo 1: Deploy do TokenRoot ───────────────────────────────────────
    // O TokenRoot precisa do walletCode (apenas a code cell, não a TVC inteira) para deployar wallets
    const walletTvc = loadContractFiles("TokenWallet").tvc;
    const { code: walletCodeCell } = await client.boc.get_code_from_tvc({ tvc: walletTvc });

    tokenRootAddress = await deployContract({
      contractName: "TokenRoot",
      constructorInput: {
        _name: name,
        _symbol: symbol,
        _decimals: TOKEN_DECIMALS,
        _walletCode: walletCodeCell,
        _owner: creatorWallet,
        _shellToConvert: 10000000000 // M-02: 10 SHELL for VMSHELL conversion — ensures enough gas for constructor + BC deploy
      },
      initialData: { deployNonce },
      signer,
      label: "TokenRoot",
      onAddressPredicted: (address) => {
        tokenRootAddress = address;
      },
      onChainAttempt: markChainAttempted,
    });

    // ── Passo 2: Predizer/Deploy do BondingCurve (Mensagem Interna) ────────
    const { abi: bcAbi, tvc: bcTvc } = loadContractFiles("BondingCurve");
    // C-05: Include static vars in initial_data for unique BondingCurve addresses
    // Fee recipient = platform FEE_WALLET for trade fee distribution
    const feeRecipient = String(config.feeWallet || "").trim();
    const { address: predictedBondingCurveAddress } = await client.abi.encode_message({
      abi: abiContract(bcAbi),
      deploy_set: {
        tvc: bcTvc,
        initial_data: {
          _tokenRoot: tokenRootAddress,
          _supplyCap: maxTokenSupply,
        },
      },
      call_set: {
        function_name: "constructor",
        input: {
          _owner: creatorWallet,
          _tokenRootAddr: tokenRootAddress,
          _name: name,
          _symbol: symbol,
          _creationFeeTxHash: Buffer.from(paymentTxHash || "genesis").toString("hex"),
          _feeRecipient: feeRecipient
        }
      },
      signer: { type: "None" }
    });
    bondingCurveAddress = predictedBondingCurveAddress;

    if (ENABLE_ONCHAIN_DEPLOY) {
      console.log(`[Deployer] Atualizando TokenRoot com BondingCurve code e deployando (DappID)...`);
      const trAbi = loadContractFiles("TokenRoot").abi;

      const { code: bcCodeCell } = await client.boc.get_code_from_tvc({ tvc: bcTvc });

      markChainAttempted();
      await client.processing.process_message({
        message_encode_params: {
          address: tokenRootAddress,
          abi: abiContract(trAbi),
          call_set: { function_name: "setBondingCurveCode", input: { _code: bcCodeCell } },
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
              _supplyCap: maxTokenSupply,
              _initialBalance: 10000000000, // 10 VMSHELL to inner BondingCurve
              _feeRecipient: feeRecipient,
              _pumpForever: Boolean(pumpForever)
            }
          },
          signer
        },
        send_events: false
      });
      console.log(`[Deployer] Mensagem interna disparada. Aguardando deploy on-chain do BondingCurve...`);
      
      // Wait for deployment
      let isDeployed = false;
      const deployAttempts = Number(
        process.env.BONDING_CURVE_DEPLOY_CONFIRM_ATTEMPTS || DEFAULT_BONDING_CURVE_DEPLOY_ATTEMPTS,
      );
      for (let i = 0; i < deployAttempts; i++) {
        await new Promise((res) => setTimeout(res, 3000));
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
    console.log(`[Deployer] TokenRoot e BondingCurve vinculados. Curva on-chain: ${bondingCurveAddress}`);

    console.log(`[Deployer] Status: ${deployStatus}`);

    return {
      tokenRoot: tokenRootAddress,
      bondingCurve: bondingCurveAddress,
      status: deployStatus,
      chainAttempted,
      reason,
    };
  } catch (error) {
    console.error("[Deployer] Erro na preparação do deploy:", error.message);
    if (chainAttempted) {
      return {
        tokenRoot: tokenRootAddress,
        bondingCurve: bondingCurveAddress,
        status: "pending_onchain_recovery",
        chainAttempted,
        reason:
          "Uma transação on-chain já foi enviada antes do erro. " +
          `Endereços preditos preservados para recuperação: ${error.message}`,
      };
    }
    return {
      tokenRoot: "",
      bondingCurve: "",
      status: "deploy_error",
      chainAttempted,
      reason: `Erro ao preparar deploy: ${error.message}`,
    };
  }
}

module.exports = {
  assertOnchainDeployReady,
  deployTokenEcosystem,
  getDeployerReadiness,
};
