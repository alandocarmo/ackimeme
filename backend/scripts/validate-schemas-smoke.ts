import {
  CreateLaunchSchema,
  AuthChallengeSchema,
  VerifyPaymentSchema,
} from "../src/validations/schemas";

const launchPayload = {
  name: "Meme",
  symbol: "MEME",
  tagline: "",
  description: "A".repeat(25),
  totalSupply: 1000000000,
  logoUrl: "",
  website: "",
  xUrl: "",
  telegramUrl: "",
  txHash: "0xabcdef1234567890abcdef1234567890",
  creatorWallet:
    "0:1111111111111111111111111111111111111111111111111111111111111111",
  pumpForever: false,
  isBoosted: false,
  slopeDivisor: 10_000_000_000_000,
};

const results = [
  ["launch", CreateLaunchSchema.safeParse(launchPayload)],
  ["auth-dev", AuthChallengeSchema.safeParse({ walletAddress: "dev-wallet-local" })],
  [
    "verify-no-symbol",
    VerifyPaymentSchema.safeParse({
      txHash: "0xabcdef1234567890abcdef1234567890",
      isBoosted: false,
    }),
  ],
] as const;

let failed = 0;
for (const [name, r] of results) {
  if (r.success) {
    console.log(`OK ${name}`);
    if (name === "launch") {
      console.log("  totalSupply parsed as:", (r.data as { totalSupply: string }).totalSupply);
    }
    if (name === "verify-no-symbol") {
      console.log("  tokenSymbol default:", (r.data as { tokenSymbol: string }).tokenSymbol);
    }
  } else {
    failed += 1;
    console.log(`FAIL ${name}`, JSON.stringify(r.error.issues));
  }
}

process.exit(failed > 0 ? 1 : 0);
