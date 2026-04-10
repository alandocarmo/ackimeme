require("dotenv").config();
const { randomUUID } = require("crypto");
const { pingDatabase, pool, runMigrations, withTransaction } = require("../src/db");

const DEMO_PROJECTS = [
  {
    slug: "shell-raiders",
    title: "Shell Raiders",
    badge: "exclusive",
    shortDescription: "Campanha exclusiva para growth inicial do ecossistema.",
    description:
      "Projeto curado pelo admin para validar tarefas sociais, submissions e fluxo de moderacao dentro do launchpad exclusivo.",
    rewardLabel: "SHELL rewards",
    rewardToken: "SHELL",
    rewardAmount: 2500,
    status: "published",
    tasks: [
      {
        title: "Entrar no grupo Telegram",
        description: "Comprove que entrou no grupo oficial da campanha.",
        taskType: "join_telegram",
        targetUrl: "https://t.me/ackimeme",
        rewardPoints: 50,
        rewardLabel: "pts",
        status: "active",
      },
      {
        title: "Seguir perfil no X",
        description: "Seguir o perfil social do projeto exclusivo.",
        taskType: "follow_x",
        targetUrl: "https://x.com/ackimeme",
        rewardPoints: 40,
        rewardLabel: "pts",
        status: "active",
      },
    ],
  },
  {
    slug: "meme-labs-allstars",
    title: "Meme Labs Allstars",
    badge: "priority",
    shortDescription: "Missao social para ativar comunidade e referrals.",
    description:
      "Segundo projeto demo para testar multiplas campanhas, ordenacao de tarefas e contagem de submissions no admin.",
    rewardLabel: "USDC rewards",
    rewardToken: "USDC",
    rewardAmount: 500,
    status: "published",
    tasks: [
      {
        title: "Compartilhar post da campanha",
        description: "Publique o link da campanha e envie a prova.",
        taskType: "share_post",
        targetUrl: "https://ackimeme.fun",
        rewardPoints: 60,
        rewardLabel: "pts",
        status: "active",
      },
      {
        title: "Visitar pagina da campanha",
        description: "Abrir a pagina da campanha para validar clickthrough.",
        taskType: "visit_url",
        targetUrl: "https://ackimeme.fun",
        rewardPoints: 20,
        rewardLabel: "pts",
        status: "active",
      },
    ],
  },
];

const DEMO_LAUNCHES = [
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
    paymentTokenSymbol: "USDC",
    paymentAmount: "10",
    riskStatus: "manual_review",
    riskScore: 37,
  },
];

async function seedLaunchpad(client) {
  await client.query(
    `
      DELETE FROM launchpad_projects
      WHERE slug = ANY($1::text[])
    `,
    [DEMO_PROJECTS.map((project) => project.slug)],
  );

  for (let projectIndex = 0; projectIndex < DEMO_PROJECTS.length; projectIndex += 1) {
    const project = DEMO_PROJECTS[projectIndex];
    const projectId = randomUUID();
    const createdAt = new Date().toISOString();

    await client.query(
      `
        INSERT INTO launchpad_projects (
          id,
          slug,
          title,
          badge,
          short_description,
          description,
          logo_url,
          cover_image_url,
          reward_label,
          reward_token,
          reward_amount,
          participant_limit,
          sort_order,
          status,
          starts_at,
          ends_at,
          created_by,
          metadata,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, '', '', $7, $8, $9, 0, $10, $11, NULL, NULL, 'seed-demo',
          $12::jsonb, $13, $14
        )
      `,
      [
        projectId,
        project.slug,
        project.title,
        project.badge,
        project.shortDescription,
        project.description,
        project.rewardLabel,
        project.rewardToken,
        project.rewardAmount,
        projectIndex,
        project.status,
        JSON.stringify({ seedTag: "demo_v1" }),
        createdAt,
        createdAt,
      ],
    );

    for (let taskIndex = 0; taskIndex < project.tasks.length; taskIndex += 1) {
      const task = project.tasks[taskIndex];
      await client.query(
        `
          INSERT INTO launchpad_tasks (
            id,
            project_id,
            title,
            description,
            task_type,
            target_url,
            reward_points,
            reward_label,
            sort_order,
            status,
            metadata,
            created_at,
            updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13
          )
        `,
        [
          randomUUID(),
          projectId,
          task.title,
          task.description,
          task.taskType,
          task.targetUrl,
          task.rewardPoints,
          task.rewardLabel,
          taskIndex,
          task.status,
          JSON.stringify({ seedTag: "demo_v1" }),
          createdAt,
          createdAt,
        ],
      );
    }
  }
}

async function seedPublicFeed(client) {
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
    await seedLaunchpad(client);
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
