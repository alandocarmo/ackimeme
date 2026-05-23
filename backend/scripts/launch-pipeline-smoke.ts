import * as dotenv from "dotenv";
dotenv.config();

// Force valid fee wallet for smoke (placeholder values in .env fail isConfiguredWallet).
process.env.FEE_WALLET =
  "0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

async function main(): Promise<void> {
  const { CreateLaunchSchema } = await import("../src/validations/schemas");
  const { normalizeLaunchRequest } = await import("../src/launches");

  const session = { walletAddress: "dev-wallet-local" };

  const frontendPayload = {
    name: "Test Meme",
    symbol: "TSTM",
    tagline: "tag",
    description: "Descrição longa o suficiente para passar validação.",
    totalSupply: 1000000000,
    logoUrl: "",
    website: "",
    xUrl: "",
    telegramUrl: "",
    txHash: "0xabcdef1234567890abcdef1234567890abcdef12",
    creatorWallet: "dev-wallet-local",
    pumpForever: false,
    isBoosted: false,
    slopeDivisor: 10_000_000_000_000,
  };

  const parsed = CreateLaunchSchema.safeParse(frontendPayload);
  if (!parsed.success) {
    console.error("ZOD_FAIL", parsed.error.issues);
    process.exit(1);
  }
  console.log("ZOD_OK");

  try {
    const launchRequest = normalizeLaunchRequest(parsed.data, session);
    console.log("NORMALIZE_OK", {
      wallet: launchRequest.creator.wallet,
      symbol: launchRequest.coin.symbol,
      txHash: `${launchRequest.payment.txHash.slice(0, 12)}...`,
      totalSupply: launchRequest.coin.totalSupply,
    });
  } catch (err) {
    console.error("NORMALIZE_FAIL", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
