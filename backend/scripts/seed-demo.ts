import "dotenv/config";
import { randomUUID } from "crypto";
import { pingDatabase, pool, runMigrations, withTransaction } from "../src/db";
import { PoolClient } from "pg";

interface DemoLaunch {
  walletAddress: string;
  name: string;
  symbol: string;
  tagline: string;
  description: string;
  totalSupply: string;
  txHash: string;
  paymentTokenSymbol: string;
  paymentAmount: string;
  riskStatus: string;
  riskScore: number;
}

const DEMO_LAUNCHES: DemoLaunch[] = [
  {
    walletAddress: "demo-feed-bot",
    name: "Acki Doge",
    symbol: "ADOGE",
    tagline: "Dog coin nascida no board publico do AckiMeme.",
    description:
      "Projeto demo para testar o feed publico geral com card publico, fee modelada e risk score inicial.",
    totalSupply: "1000000000",
    txHash: "demo-tx-hash-001",
    paymentTokenSymbol: "SHELL",
    paymentAmount: "3",
    riskStatus: "manual_review",
    riskScore: 42,
  },
  {
    walletAddress: "demo-feed-bot",
    name: "Meme Bolt",
    symbol: "MBOLT",
    tagline: "Segundo projeto demo para o board publico.",
    description:
      "Projeto demo adicional para validar busca, densidade do feed e ordenacao visual no frontend.",
    totalSupply: "500000000",
    txHash: "demo-tx-hash-002",
    paymentTokenSymbol: "SHELL",
    paymentAmount: "3",
    riskStatus: "manual_review",
    riskScore: 37,
  },
];

async function seedPublicFeed(client: PoolClient) {
  await client.query(
    `
      DELETE FROM launches
      WHERE wallet_address = 'demo-feed-bot'
    `,
  );

  for (const launch of DEMO_LAUNCHES) {
    const launchId = randomUUID();
    const treasuryId = randomUUID();
    const riskId = randomUUID();
    const createdAt = new Date().toISOString();
    const launchRequest = {
      creator: {
        wallet: launch.walletAddress,
        sessionId: "",
        telegramUserId: "",
      },
      payment: {
        txHash: launch.txHash,
        tokenSymbol: launch.paymentTokenSymbol,
        requiredAmount: Number(launch.paymentAmount),
        networkSettlementToken: "VMSHELL",
        networkSettlementStatus: "pending_blockchain_settlement",
      },
      protocol: {
        distribution: {
          creatorPercent: 80,
          lockedReservePercent: 20,
        },
        treasury: {
          appFeeSharePercent: 100,
          feeWallet: process.env.FEE_WALLET || "demo_fee_wallet",
        },
        launchMode: "factory_pending",
        bondingCurveStatus: "not_implemented",
        poolAutomationStatus: "not_implemented",
      },
      coin: {
        name: launch.name,
        symbol: launch.symbol,
        tagline: launch.tagline,
        description: launch.description,
        totalSupply: launch.totalSupply,
        logoUrl: "",
      },
      links: {
        website: "",
        xUrl: "",
        telegramUrl: "",
      },
      context: {
        app: process.env.APP_NAME || "AckiMeme",
        network: process.env.APP_NETWORK || "Acki Nacki",
        submittedAt: createdAt,
      },
    };
    const treasuryPayment = {
      id: treasuryId,
      creatorWallet: launch.walletAddress,
      txHash: launch.txHash,
      tokenSymbol: launch.paymentTokenSymbol,
      amount: Number(launch.paymentAmount),
      feeWallet: process.env.FEE_WALLET || "demo_fee_wallet",
      appFeeSharePercent: 100,
      networkSettlementToken: "VMSHELL",
      networkSettlementStatus: "pending_blockchain_settlement",
      recordedAt: createdAt,
    };
    const riskProfile = {
      id: riskId,
      launchId,
      creatorWallet: launch.walletAddress,
      score: launch.riskScore,
      status: launch.riskStatus,
      signals: [{ type: "seed_demo", severity: "low" }],
      createdAt,
    };

    await client.query(
      `
        INSERT INTO launches (
          id,
          status,
          minting_available,
          note,
          wallet_address,
          is_public,
          curated_by_admin,
          launch_request,
          treasury_payment,
          risk_profile,
          created_at
        ) VALUES (
          $1, 'payment_verified_waiting_blockchain_integration', FALSE,
          'Seed demo data para o feed publico.', $2, TRUE, FALSE, $3::jsonb, $4::jsonb, $5::jsonb, $6
        )
      `,
      [
        launchId,
        launch.walletAddress,
        JSON.stringify(launchRequest),
        JSON.stringify(treasuryPayment),
        JSON.stringify(riskProfile),
        createdAt,
      ],
    );

    await client.query(
      `
        INSERT INTO treasury_payments (
          id,
          launch_id,
          creator_wallet,
          tx_hash,
          token_symbol,
          amount,
          fee_wallet,
          app_fee_share_percent,
          network_settlement_token,
          network_settlement_status,
          recorded_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 100, 'VMSHELL', 'pending_blockchain_settlement', $8
        )
      `,
      [
        treasuryId,
        launchId,
        launch.walletAddress,
        launch.txHash,
        launch.paymentTokenSymbol,
        Number(launch.paymentAmount),
        process.env.FEE_WALLET || "demo_fee_wallet",
        createdAt,
      ],
    );

    await client.query(
      `
        INSERT INTO risk_profiles (
          id,
          launch_id,
          creator_wallet,
          score,
          status,
          signals,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      `,
      [
        riskId,
        launchId,
        launch.walletAddress,
        launch.riskScore,
        launch.riskStatus,
        JSON.stringify([{ type: "seed_demo", severity: "low" }]),
        createdAt,
      ],
    );
  }
}

async function main() {
  await pingDatabase();
  await runMigrations();

  await withTransaction(async (client) => {
    await seedPublicFeed(client);
  });

  console.log("Demo seed applied.");
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
