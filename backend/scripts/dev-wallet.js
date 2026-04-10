const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");
const walletFile = path.join(dataDir, "dev-wallet.json");

function ensureDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function getRawPublicKeyHex(publicKeyPem) {
  const spkiDer = crypto
    .createPublicKey(publicKeyPem)
    .export({ format: "der", type: "spki" });

  return Buffer.from(spkiDer).subarray(-32).toString("hex");
}

function initWallet() {
  ensureDir();

  if (fs.existsSync(walletFile)) {
    const existing = JSON.parse(fs.readFileSync(walletFile, "utf8"));
    console.log(JSON.stringify(existing, null, 2));
    return;
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" });
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" });

  const payload = {
    walletAddress: "dev-wallet-local",
    publicKeyHex: getRawPublicKeyHex(publicKeyPem),
    publicKeyPem,
    privateKeyPem,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(walletFile, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
}

function readWallet() {
  if (!fs.existsSync(walletFile)) {
    throw new Error(
      "Carteira de teste não encontrada. Rode `npm run dev:wallet:init` primeiro.",
    );
  }

  return JSON.parse(fs.readFileSync(walletFile, "utf8"));
}

function readMessage() {
  const fileArg = process.argv[3];

  if (fileArg) {
    return fs.readFileSync(path.resolve(process.cwd(), fileArg), "utf8");
  }

  return fs.readFileSync(0, "utf8");
}

function signMessage() {
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

  console.log(
    JSON.stringify(
      {
        walletAddress: wallet.walletAddress,
        publicKeyHex: wallet.publicKeyHex,
        signatureHex: signature.toString("hex"),
        message,
      },
      null,
      2,
    ),
  );
}

function main() {
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
