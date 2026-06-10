import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { config } from "../config";
import { getAccountPublicKey, getAccountBalanceNano, getAccountState, getAccountEccBalanceNano } from "./graphql.service";
import { parseSlopeDivisor } from "../launches";
import { getTvmClient, getTvmCore, sdkAvailable as isTvmSdkAvailable } from "./tvm-client";

/**
 * deployer.service.ts
 *
 * Serviço de deploy dos contratos TokenRoot e BondingCurve na Acki Nacki.
 */

const ABI_DIR = path.join(__dirname, "../abi");

// Flag de controle — habilita envio real à blockchain
const ENABLE_ONCHAIN_DEPLOY = process.env.ENABLE_ONCHAIN_DEPLOY === "true";
const TOKEN_DECIMALS = 9;
const SHELL_CURRENCY_ID = 2;
const DEFAULT_DEPLOY_PREFUND_SHELL_NANO = "10000000000"; // 10 SHELL ECC
const DEFAULT_DEPLOY_PREFUND_MESSAGE_VALUE_NANO = "12000000000"; // 12 VMSHELL (10 for BC + 2 for gas)
const DEFAULT_DEPLOY_FUNDING_ATTEMPTS = 40;

let client: any = null;
let sdkAvailable = false;
let abiContract: any = null;
let signerKeys: any = null;

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
function contractFilesExist(contractName: string): boolean {
  const abiPath = path.join(ABI_DIR, `${contractName}.abi.json`);
  const tvcPath = path.join(ABI_DIR, `${contractName}.tvc`);
  return fs.existsSync(abiPath) && fs.existsSync(tvcPath);
}

/**
 * Carrega ABI e TVC de um contrato.
 */
const _contractFileCache = new Map<string, { abi: any; tvc: string }>();
function loadContractFiles(contractName: string): { abi: any; tvc: string } {
  if (_contractFileCache.has(contractName)) {
    return _contractFileCache.get(contractName)!;
  }
  const abiPath = path.join(ABI_DIR, `${contractName}.abi.json`);
  const tvcPath = path.join(ABI_DIR, `${contractName}.tvc`);
  const result = {
    abi: JSON.parse(fs.readFileSync(abiPath, "utf-8")),
    tvc: fs.readFileSync(tvcPath).toString("base64"),
  };
  _contractFileCache.set(contractName, result);
  return result;
}

function parseTokenSupplyToNano(totalSupply: string | number, decimals = TOKEN_DECIMALS): string {
  const digits = String(totalSupply || "").trim().replace(/[.,]/g, "");
  if (!/^\d+$/.test(digits) || digits === "0") {
    throw new Error("totalSupply inválido para deploy on-chain.");
  }
  return (BigInt(digits) * (10n ** BigInt(decimals))).toString();
}

interface BuildDeployNonceParams {
  creatorWallet: string;
  symbol: string;
  paymentTxHash: string;
}

function buildDeployNonce({ creatorWallet, symbol, paymentTxHash }: BuildDeployNonceParams): string {
  const input = [
    "ackimeme-token-root-v1",
    String(creatorWallet || "").toLowerCase(),
    String(symbol || "").toUpperCase(),
    String(paymentTxHash || "").toLowerCase()
  ].join(":");
  const digest = crypto.createHash("sha256").update(input).digest("hex");
  return BigInt(`0x${digest}`).toString();
}

function normalizeHex(value: string | undefined): string {
  return String(value || "").trim().replace(/^0x/i, "");
}

function isPlaceholder(value: string | undefined): boolean {
  return !value || value.includes("CONFIGURE") || value.includes("your_") || value.includes("YOUR_");
}

function getPositiveIntegerEnv(name: string, fallback: string): string {
  const value = String(process.env[name] || fallback).trim();
  if (!/^\d+$/.test(value) || BigInt(value) <= 0n) {
    throw new Error(`${name} deve ser um inteiro positivo em nano units.`);
  }
  return value;
}

function getNonNegativeIntegerEnv(name: string, fallback: string): string {
  const value = String(process.env[name] || fallback).trim();
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} deve ser um inteiro não negativo em nano units.`);
  }
  return value;
}

interface DeployerKeyConfig {
  configured: boolean;
  usable: boolean;
  reason?: string;
  publicKey?: string;
  secretKey?: string;
  secretFormat?: "raw_secret" | "signer_secret";
}

function loadDeployerKeyConfig(): DeployerKeyConfig {
  let fileKeys: any = {};
  const keyFile = String(process.env.DEPLOYER_KEYS_FILE || "").trim();
  if (keyFile && !isPlaceholder(keyFile)) {
    if (!fs.existsSync(keyFile)) {
      return { configured: false, usable: false, reason: `DEPLOYER_KEYS_FILE não encontrado: ${keyFile}` };
    }
    try {
      fileKeys = JSON.parse(fs.readFileSync(keyFile, "utf-8"));
    } catch (err: any) {
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

async function resolveDeployerKeyPair(): Promise<{ public: string; secret: string }> {
  const keyConfig = loadDeployerKeyConfig();
  if (!keyConfig.usable || !keyConfig.secretKey) {
    throw new Error(keyConfig.reason || "Key config not usable");
  }

  let keyPair: { public: string; secret: string };
  if (keyConfig.secretFormat === "raw_secret") {
    const naclKeyPair = await client.crypto.nacl_sign_keypair_from_secret_key({
      secret: keyConfig.secretKey,
    });
    keyPair = {
      public: naclKeyPair.public,
      secret: keyConfig.secretKey, // use original 64-char seed
    };
  } else {
    keyPair = {
      public: keyConfig.secretKey.slice(64),
      secret: keyConfig.secretKey.slice(0, 64),
    };
  }

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

async function waitForFutureAddressFunding(address: string, minGasBalanceNano: string): Promise<boolean> {
  const attempts = Number(process.env.DEPLOY_FUNDING_CONFIRM_ATTEMPTS || DEFAULT_DEPLOY_FUNDING_ATTEMPTS);
  for (let i = 0; i < attempts; i += 1) {
    const gasBalanceNano = await getAccountBalanceNano(address);
    if (gasBalanceNano >= BigInt(minGasBalanceNano)) {
      return true;
    }
    await new Promise((res) => setTimeout(res, 3000));
  }
  return false;
}

async function buildEmptyPayloadCell(): Promise<string> {
  const { boc } = await client.boc.encode_boc({ builder: [] });
  return boc;
}

async function prefundFutureContractAddress(address: string, signer: any, onChainAttempt?: () => void): Promise<void> {
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
          flags: 16,
          payload,
        },
      },
      signer,
    },
    send_events: false,
  });

  // Audit #2: Wait for gas funding (VMSHELL), not ECC balance.
  const funded = await waitForFutureAddressFunding(address, prefundShellNano);
  if (!funded) {
    throw new Error(
      `Timeout aguardando pré-financiamento do endereço futuro ${address}. ` +
        "A transação de funding foi enviada; verifique a wallet financiadora e o GraphQL.",
    );
  }
}

interface DeployerReadiness {
  enabled: boolean;
  sdkAvailable: boolean;
  privateKeyConfigured: boolean;
  keyPairConfigured: boolean;
  keyPairReason: string;
  fundingWalletConfigured: boolean;
  contractsCompiled: boolean;
}

export function getDeployerReadiness(): DeployerReadiness {
  const keyConfig = loadDeployerKeyConfig();
  const fundingWallet = String(process.env.DEPLOYER_WALLET_ADDRESS || "").trim();
  const fundingWalletConfigured = Boolean(fundingWallet) && !isPlaceholder(fundingWallet);

  return {
    enabled: ENABLE_ONCHAIN_DEPLOY,
    sdkAvailable: Boolean(sdkAvailable && client),
    privateKeyConfigured: Boolean(keyConfig.usable),
    keyPairConfigured: Boolean(keyConfig.usable),
    keyPairReason: keyConfig.usable ? "" : (keyConfig.reason || "Deployer secret key missing or invalid"),
    fundingWalletConfigured,
    contractsCompiled:
      contractFilesExist("TokenRoot") &&
      contractFilesExist("TokenWallet") &&
      contractFilesExist("BondingCurve") &&
      contractFilesExist("UpdateCustodianMultisigWallet"),
  };
}

export function assertOnchainDeployReady(): void {
  const readiness = getDeployerReadiness();
  if (!readiness.enabled) {
    return;
  }

  const missing: string[] = [];
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

interface DeployContractParams {
  contractName: string;
  constructorInput: any;
  initialData?: any;
  signer: any;
  label: string;
  onAddressPredicted?: (address: string) => void;
  onChainAttempt?: () => void;
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
}: DeployContractParams): Promise<string> {
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
    await client.processing.process_message({
      message_encode_params: deployParams,
      send_events: false,
    });
    console.log(`[Deployer] ${label}: Deploy confirmed! Address: ${address}`);
  } else {
    console.log(`[Deployer] ${label}: Predicted address: ${address} (ENABLE_ONCHAIN_DEPLOY=false)`);
  }

  return address;
}

interface DeployTokenEcosystemParams {
  name: string;
  symbol: string;
  totalSupply: string | number;
  ipfsHash?: string;
  creatorWallet: string;
  paymentTxHash: string;
  pumpForever: boolean;
  slopeDivisor: any;
}

interface DeployResult {
  tokenRoot: string;
  bondingCurve: string;
  status: string;
  chainAttempted: boolean;
  reason?: string;
}

/**
 * Executa o deploy completo: TokenRoot + BondingCurve.
 */
export async function deployTokenEcosystem({
  name,
  symbol,
  totalSupply,
  ipfsHash,
  creatorWallet,
  paymentTxHash,
  pumpForever,
  slopeDivisor,
}: DeployTokenEcosystemParams): Promise<DeployResult> {
  let chainAttempted = false;
  let tokenRootAddress = "";
  let bondingCurveAddress = "";
  const markChainAttempted = () => {
    chainAttempted = true;
  };
  const maxTokenSupply = parseTokenSupplyToNano(totalSupply);
  
  // Use finalNanoDivisor for BOTH prediction and deployment to prevent address divergence
  const finalNanoDivisor = String(parseSlopeDivisor(slopeDivisor));
  
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
      public: keyPair.public,
      secret: keyPair.secret,
    });

    console.log(`[Deployer] Preparando deploy para: ${name} (${symbol})`);

    // ── Passo 1: Predizer Endereços (TokenRoot e BondingCurve) ─────────────
    const trAbi = loadContractFiles("TokenRoot").abi;
    const trTvc = loadContractFiles("TokenRoot").tvc;
    
    // Predizer TokenRoot
    const factoryAddress = process.env.LAUNCH_FACTORY_ADDRESS || "0:0000000000000000000000000000000000000000000000000000000000000000";
    const { address: predictedTokenRootAddress } = await client.abi.encode_message({
      abi: abiContract(trAbi),
      deploy_set: {
        tvc: trTvc,
        initial_data: {
          _deployer: factoryAddress,
          _name: name,
          _symbol: symbol,
          _decimals: TOKEN_DECIMALS
        },
      },
      signer: { type: "None" } // Usando signer None para que pubkey = 0, combinando com tvm.buildStateInit da LaunchFactory
    });
    tokenRootAddress = predictedTokenRootAddress;

    // Predizer BondingCurve
    const { abi: bcAbi, tvc: bcTvc } = loadContractFiles("BondingCurve");
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
      signer: { type: "None" } // C2: Usando signer None para que pubkey = 0, igual a LaunchFactory
    });
    bondingCurveAddress = predictedBondingCurveAddress;

    // ── Passo 2: Interagir com a LaunchFactory ───────────────────────────────
    if (ENABLE_ONCHAIN_DEPLOY) {
      const factoryAddress = process.env.LAUNCH_FACTORY_ADDRESS;
      if (!factoryAddress || isPlaceholder(factoryAddress)) {
        throw new Error("LAUNCH_FACTORY_ADDRESS ausente no .env. Impossível realizar deploy via Factory.");
      }

      console.log(`[Deployer] Acionando LaunchFactory (${factoryAddress}) para deploy unificado do Dapp ID...`);
      markChainAttempted();
      
      const factoryAbi = loadContractFiles("LaunchFactory").abi;

      await prefundFutureContractAddress(factoryAddress, signer, markChainAttempted);

      // We call deployTokenAndCurve on the LaunchFactory
      await client.processing.process_message({
        message_encode_params: {
          address: factoryAddress,
          abi: abiContract(factoryAbi),
          call_set: {
            function_name: "deployTokenAndCurve",
            input: {
              name,
              symbol,
              decimals: TOKEN_DECIMALS,
              supplyCap: maxTokenSupply,
              creator: creatorWallet,
              creationFeeTxHash: paymentTxHash || "genesis",
              pumpForever: Boolean(pumpForever),
              slopeDivisor: finalNanoDivisor
            }
          },
          signer
        },
        send_events: false
      });

      console.log(`[Deployer] LaunchFactory chamada com sucesso. Endereços preditos: TokenRoot=${tokenRootAddress}, BondingCurve=${bondingCurveAddress}`);
      console.log(`[Deployer] Monitoramento on-chain assumirá daqui para confirmar o deploy na rede.`);
    }

    // Determinar status baseado no flag de deploy
    const deployStatus = ENABLE_ONCHAIN_DEPLOY ? "deployment_queued" : "awaiting_chain_integration";
    const reason = ENABLE_ONCHAIN_DEPLOY
      ? ""
      : "Endereços dos contratos calculados, mas ENABLE_ONCHAIN_DEPLOY=false. "
        + "Defina ENABLE_ONCHAIN_DEPLOY=true no .env quando pronto para produção.";

    console.log(`[Deployer] TokenRoot: ${tokenRootAddress}`);
    console.log(`[Deployer] TokenRoot e BondingCurve vinculados. Curva on-chain: ${bondingCurveAddress}`);

    return {
      tokenRoot: tokenRootAddress,
      bondingCurve: bondingCurveAddress,
      status: deployStatus,
      chainAttempted,
      reason,
    };
  } catch (error: any) {
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
