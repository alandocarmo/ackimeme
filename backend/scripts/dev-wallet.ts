import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

const dataDir = path.join(__dirname, "..", "data");
const walletFile = path.join(dataDir, "dev-wallet.json");

interface DevWallet {
  walletAddress: string;
  publicKeyHex: string;
  publicKeyPem: string;
  privateKeyPem: string;
  createdAt: string;
}

interface SignResult {
  walletAddress: string;
  publicKeyHex: string;
  signatureHex: string;
  message: string;
}

function ensureDir(): void {
  fs.mkdirSync(dataDir, { recursive: true });
}

function getRawPublicKeyHex(publicKeyPem: string): string {
  const spkiDer = crypto
    .createPublicKey(publicKeyPem)
    .export({ format: "der", type: "spki" });

  return Buffer.from(spkiDer).subarray(-32).toString("hex");
}

function initWallet(): void {
  ensureDir();

  if (fs.existsSync(walletFile)) {
    const existing: DevWallet = JSON.parse(fs.readFileSync(walletFile, "utf8"));
    console.log(JSON.stringify(existing, null, 2));
    return;
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }) as string;
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }) as string;

  const payload: DevWallet = {
    walletAddress: "dev-wallet-local",
    publicKeyHex: getRawPublicKeyHex(publicKeyPem),
    publicKeyPem,
    privateKeyPem,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(walletFile, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
}

function readWallet(): DevWallet {
  if (!fs.existsSync(walletFile)) {
    throw new Error(
      "Carteira de teste não encontrada. Rode `npm run dev:wallet:init` primeiro.",
    );
  }

  return JSON.parse(fs.readFileSync(walletFile, "utf8")) as DevWallet;
}

function readMessage(): string {
  const fileArg = process.argv[3];

  if (fileArg) {
    return fs.readFileSync(path.resolve(process.cwd(), fileArg), "utf8");
  }

  return fs.readFileSync(0, "utf8");
}

function signMessage(): void {
  const wallet = readWallet();
  const message = readMessage();

  if (!message.trim()) {
    throw new Error("Mensagem do challenge vazia.");
  }

  const signature = crypto.sign(
    null,
    Buffer.from(message, "utf8"),
    wallet.privateKeyPem,
  );

  const result: SignResult = {
    walletAddress: wallet.walletAddress,
    publicKeyHex: wallet.publicKeyHex,
    signatureHex: signature.toString("hex"),
    message,
  };

  console.log(JSON.stringify(result, null, 2));
}

function main(): void {
  const command = process.argv[2];

  if (command === "init") {
    initWallet();
    return;
  }

  if (command === "sign") {
    signMessage();
    return;
  }

  throw new Error("Use `init` ou `sign`.");
}

main();
