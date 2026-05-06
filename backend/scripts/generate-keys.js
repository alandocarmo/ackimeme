const { getTvmClient, sdkAvailable } = require("../src/services/tvm-client");

async function main() {
  if (!sdkAvailable) {
    throw new Error("TVM SDK indisponível. Compile tvmsdk.node e configure TVM_SDK_NODE_BINARY.");
  }
  const client = getTvmClient();

  try {
    // 1. Gera uma seed phrase aleatória
    const seed = await client.crypto.mnemonic_from_random({ dictionary: 1, word_count: 12 });
    
    // 2. Transforma a seed no par de chaves (Public & Secret)
    const keyPair = await client.crypto.mnemonic_derive_sign_keys({
      phrase: seed.phrase,
      path: "m/44'/396'/0'/0/0", // Default path
      dictionary: 1,
      word_count: 12
    });

    console.log("=== KEYPAIR TVM SDK GERADO ===");
    console.log("SEU NOVO SEED PHRASE (Anote!):", seed.phrase);
    console.log("SUA CHAVE PÚBLICA (Public):", keyPair.public);
    console.log("SUA CHAVE SECRETA (Secret / DEPLOYER_SECRET_KEY):", keyPair.secret);
    
    console.log("\nConfigure DEPLOYER_SECRET_KEY, DEPLOYER_PUBLIC_KEY e uma DEPLOYER_WALLET_ADDRESS financiada.");
    
    if (typeof client.close === "function") client.close();
  } catch (err) {
    console.error("Erro:", err);
    if (typeof client.close === "function") client.close();
  }
}

main();
