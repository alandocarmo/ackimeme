const { TvmClient } = require("@tvmsdk/core");
const { libNode } = require("@tvmsdk/lib-node");

TvmClient.useBinaryLibrary(libNode);

async function main() {
  const client = new TvmClient({
    network: {
      endpoints: ["https://shellnet.ackinacki.org"]
    }
  });

  try {
    // 1. Gera uma seed phrase aleatória
    const entropy = await client.crypto.generate_random_bytes({ length: 32 });
    const seed = await client.crypto.mnemonic_from_random({ dictionary: 1, word_count: 12 });
    
    // 2. Transforma a seed no par de chaves (Public & Secret)
    const keyPair = await client.crypto.mnemonic_derive_sign_keys({
      phrase: seed.phrase,
      path: "m/44'/396'/0'/0/0", // Default path
      dictionary: 1,
      word_count: 12
    });

    console.log("=== SETUP BURLADO COM SUCESSO ===");
    console.log("SEU NOVO SEED PHRASE (Anote!):", seed.phrase);
    console.log("SUA CHAVE PÚBLICA (Public):", keyPair.public);
    console.log("SUA CHAVE SECRETA (Secret / DEPLOYER_PRIVATE_KEY):", keyPair.secret);
    
    console.log("\nOBS: Com essa Secret Key, você nem precisa de MultiSig para a nossa Demo.");
    console.log("Basta importar esse Seed Phrase em uma carteira compatível com TVM (Ex: Ever Wallet, Venom Wallet) conectada na Shellnet Acki Nacki e pedir os tokens no faucet direto para ela!");
    
    client.close();
  } catch (err) {
    console.error("Erro:", err);
    client.close();
  }
}

main();
