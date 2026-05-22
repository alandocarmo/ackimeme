// Teste prático do Backend: Deployer e Pagamentos
import { deployTokenEcosystem } from "../src/services/deployer.service";
import { verifyPayment } from "../src/payments";

async function runTests(): Promise<void> {
  console.log("=== INICIANDO TESTE PRÁTICO ===");
  
  // Teste 1: Deployer Real
  try {
    console.log("[- Teste 1: deployTokenEcosystem -]");
    // Usaremos valores default que falharão de forma controlada se faltar a DEPLOYER_SECRET_KEY
    const result = await deployTokenEcosystem({
      name: "Test Coin",
      symbol: "TESTC",
      totalSupply: "1000000000",
      ipfsHash: "QmTeste123",
      creatorWallet: "0:bdf1f14108bcc289dac252d970a74bee29386e7a7782937f2bcd92e7f2dba1be", // Carteira mock que geramos
      paymentTxHash: "0xFakeDeployHash",
      pumpForever: false,
      slopeDivisor: "1000000000",
    });
    console.log(">> SUCESSO DEPLOYER:", result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(">> ERRO CONTROLADO DEPLOYER (Falta de envs):", message);
  }

  // Teste 2: Verify Payment Logic (Mocking SHELL txHash that does not exist to see how it fails)
  try {
    console.log("\n[- Teste 2: verifyPayment (SHELL) -]");
    await verifyPayment({
      walletAddress: "0:bdf1f14108bcc289dac252d970a74bee29386e7a7782937f2bcd92e7f2dba1be",
      txHash: "0xFakeHash123",
      tokenSymbol: "SHELL"
    });
    console.log(">> SUCESSO PAGAMENTO (Inesperado)");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(">> ERRO CONTROLADO PAGAMENTO:", message);
  }
}

runTests();
