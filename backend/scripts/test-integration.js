// Teste prático do Backend: Deployer e Pamentos
const { deployTokenEcosystem } = require("../src/services/deployer.service");
const { verifyPayment } = require("../src/payments");

async function runTests() {
  console.log("=== INICIANDO TESTE PRÁTICO ===");
  
  // Teste 1: Deployer Real
  try {
    console.log("[- Teste 1: deployTokenEcosystem -]");
    // Usaremos valores default que falharão de forma controlada se faltar a DEPLOYER_PRIVATE_KEY
    const result = await deployTokenEcosystem({
      name: "Test Coin",
      symbol: "TESTC",
      totalSupply: "1000000000",
      ipfsHash: "QmTeste123",
      creatorWallet: "0:bdf1f14108bcc289dac252d970a74bee29386e7a7782937f2bcd92e7f2dba1be" // Carteira mock que geramos
    });
    console.log(">> SUCESSO DEPLOYER:", result);
  } catch (error) {
    console.log(">> ERRO CONTROLADO DEPLOYER (Falta de envs):", error.message);
  }

  // Teste 2: Verify Payment Logic (Mocking USDC txHash that does not exist to see how it fails)
  try {
    console.log("\n[- Teste 2: verifyPayment (USDC) -]");
    await verifyPayment({
      walletAddress: "0:bdf1f14108bcc289dac252d970a74bee29386e7a7782937f2bcd92e7f2dba1be",
      txHash: "0xFakeHash123",
      tokenSymbol: "USDC"
    });
    console.log(">> SUCESSO PAGAMENTO (Inesperado)");
  } catch (error) {
    console.log(">> ERRO CONTROLADO PAGAMENTO:", error.message);
  }
}

runTests();
