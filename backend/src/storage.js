const { query, withTransaction } = require("./db");

const USED_CHALLENGE_RETENTION_DAYS = 7;

function normalizeChallengeRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    nonce: row.nonce,
    walletAddress: row.wallet_address,
    telegramBinding: row.telegram_binding || {},
    message: row.message,
    issuedAt: row.issued_at?.toISOString?.() || row.issued_at,
    expiresAt: row.expires_at?.toISOString?.() || row.expires_at,
    usedAt: row.used_at?.toISOString?.() || row.used_at || "",
  };
}

function normalizeSessionRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    walletAddress: row.wallet_address,
    publicKey: row.public_key,
    proofLevel: row.proof_level,
    telegramBinding: row.telegram_binding || {},
    issuedAt: row.issued_at?.toISOString?.() || row.issued_at,
    expiresAt: row.expires_at?.toISOString?.() || row.expires_at,
    lastSeenAt: row.last_seen_at?.toISOString?.() || row.last_seen_at,
  };
}

function normalizeLaunchRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    status: row.status,
    mintingAvailable: row.minting_available,
    note: row.note,
    launchRequest: row.launch_request,
    treasuryPayment: row.treasury_payment,
    riskProfile: row.risk_profile,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    curatedByAdmin: row.curated_by_admin,
    isPublic: row.is_public,
    ipfsHash: row.ipfs_hash || "",
    tokenRootAddress: row.token_root_address || "",
    bondingCurveAddress: row.bonding_curve_address || "",
    onchainData: {
      deployStatus: row.deploy_status || "pending",
      deployReason: row.deploy_reason || "",
      reserveBalance: row.reserve_balance ? row.reserve_balance.toString() : "0",
      tokenSupply: row.token_supply ? row.token_supply.toString() : "0",
      lockedLiquidity: row.locked_liquidity || false,
      updatedAt: row.onchain_updated_at?.toISOString?.() || row.onchain_updated_at || null,
    }
  };
}


function normalizeLaunchpadProjectRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    badge: row.badge,
    shortDescription: row.short_description,
    description: row.description,
    logoUrl: row.logo_url,
    coverImageUrl: row.cover_image_url,
    rewardLabel: row.reward_label,
    rewardToken: row.reward_token,
    rewardAmount: Number(row.reward_amount || 0),
    participantLimit: row.participant_limit,
    sortOrder: row.sort_order,
    status: row.status,
    startsAt: row.starts_at?.toISOString?.() || row.starts_at || "",
    endsAt: row.ends_at?.toISOString?.() || row.ends_at || "",
    createdBy: row.created_by,
    metadata: row.metadata || {},
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function normalizeLaunchpadTaskRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    taskType: row.task_type,
    targetUrl: row.target_url,
    rewardPoints: row.reward_points,
    rewardLabel: row.reward_label,
    sortOrder: row.sort_order,
    status: row.status,
    metadata: row.metadata || {},
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function normalizeLaunchpadSubmissionRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    projectId: row.project_id,
    taskId: row.task_id,
    walletAddress: row.wallet_address,
    sessionId: row.session_id,
    status: row.status,
    proofText: row.proof_text,
    proofUrl: row.proof_url,
    reviewedAt: row.reviewed_at?.toISOString?.() || row.reviewed_at || "",
    reviewedBy: row.reviewed_by || "",
    reviewNote: row.review_note || "",
    projectTitle: row.project_title || "",
    taskTitle: row.task_title || "",
    metadata: row.metadata || {},
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function attachLaunchpadRelations(projects, tasks, projectMetrics, taskMetrics) {
  const taskMap = new Map();
  const projectMetricMap = new Map();
  const taskMetricMap = new Map();

  for (const task of tasks) {
    const nextList = taskMap.get(task.projectId) || [];
    nextList.push({
      ...task,
      submissionCount: 0,
    });
    taskMap.set(task.projectId, nextList);
  }

  for (const metric of projectMetrics) {
    projectMetricMap.set(metric.projectId, metric);
  }

  for (const metric of taskMetrics) {
    taskMetricMap.set(metric.taskId, metric);
  }

  return projects.map((project) => {
    const projectTasks = (taskMap.get(project.id) || []).map((task) => ({
      ...task,
      submissionCount: taskMetricMap.get(task.id)?.submissionCount || 0,
    }));
    const projectMetric = projectMetricMap.get(project.id);

    return {
      ...project,
      taskCount: projectTasks.length,
      submissionCount: projectMetric?.submissionCount || 0,
      participantCount: projectMetric?.participantCount || 0,
      tasks: projectTasks,
    };
  });
}

async function updateLaunchOnchainState(
  launchId,
  { reserveBalance, tokenSupply, lockedLiquidity, status, deployStatus, deployReason },
) {
  const sets = [
    `reserve_balance = $1`,
    `token_supply = $2`,
    `locked_liquidity = $3`,
    `onchain_updated_at = NOW()`
  ];
  const params = [reserveBalance, tokenSupply, lockedLiquidity];

  if (status) {
    params.push(status);
    sets.push(`status = $${params.length}`);
  }

  if (deployStatus) {
    params.push(deployStatus);
    sets.push(`deploy_status = $${params.length}`);
  }

  if (deployReason !== undefined) {
    params.push(deployReason);
    sets.push(`deploy_reason = $${params.length}`);
  }

  params.push(launchId);
  const queryStr = `UPDATE launches SET ${sets.join(', ')} WHERE id = $${params.length}`;

  await query(queryStr, params);
}

async function cleanupExpiredAuthData() {
  await query(
    `
      DELETE FROM auth_challenges
      WHERE used_at IS NULL
        AND expires_at <= NOW()
    `,
  );

  await query(
    `
      DELETE FROM auth_challenges
      WHERE used_at IS NOT NULL
        AND used_at <= NOW() - ($1::int * INTERVAL '1 day')
    `,
    [USED_CHALLENGE_RETENTION_DAYS],
  );

  await query(
    `
      DELETE FROM wallet_sessions
      WHERE expires_at <= NOW()
    `,
  );

  await query(
    `
      DELETE FROM qr_sessions
      WHERE expires_at <= NOW()
    `,
  );
}

async function createAuthChallenge(challenge, auditEvent) {


  await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO auth_challenges (
          id,
          nonce,
          wallet_address,
          telegram_binding,
          message,
          issued_at,
          expires_at
        ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
      `,
      [
        challenge.id,
        challenge.nonce,
        challenge.walletAddress,
        JSON.stringify(challenge.telegramBinding),
        challenge.message,
        challenge.issuedAt,
        challenge.expiresAt,
      ],
    );

    await client.query(
      `
        INSERT INTO audit_events (
          id,
          type,
          created_at,
          wallet_address,
          challenge_id,
          payload
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        auditEvent.id,
        auditEvent.type,
        auditEvent.createdAt,
        auditEvent.walletAddress,
        auditEvent.challengeId,
        JSON.stringify(auditEvent.payload || {}),
      ],
    );
  });

  return challenge;
}

async function getUnusedChallengeById(challengeId) {

  const result = await query(
    `
      SELECT *
      FROM auth_challenges
      WHERE id = $1
        AND used_at IS NULL
      LIMIT 1
    `,
    [challengeId],
  );

  return normalizeChallengeRow(result.rows[0]);
}

async function consumeChallengeAndCreateSession({
  challengeId,
  session,
  auditEvent,
}) {


  return withTransaction(async (client) => {
    const challengeUpdate = await client.query(
      `
        UPDATE auth_challenges
        SET used_at = $2
        WHERE id = $1
          AND used_at IS NULL
        RETURNING id
      `,
      [challengeId, new Date().toISOString()],
    );

    if (challengeUpdate.rowCount === 0) {
      throw new Error("Challenge não encontrado ou já utilizado.");
    }

    await client.query(
      `
        INSERT INTO wallet_sessions (
          id,
          token,
          wallet_address,
          public_key,
          proof_level,
          telegram_binding,
          issued_at,
          expires_at,
          last_seen_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
      `,
      [
        session.id,
        session.token,
        session.walletAddress,
        session.publicKey,
        session.proofLevel,
        JSON.stringify(session.telegramBinding),
        session.issuedAt,
        session.expiresAt,
        session.lastSeenAt,
      ],
    );

    await client.query(
      `
        INSERT INTO audit_events (
          id,
          type,
          created_at,
          wallet_address,
          session_id,
          payload
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        auditEvent.id,
        auditEvent.type,
        auditEvent.createdAt,
        auditEvent.walletAddress,
        auditEvent.sessionId,
        JSON.stringify(auditEvent.payload || {}),
      ],
    );

    return session;
  });
}

async function createSessionOnly({ session, auditEvent }) {
  return withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO wallet_sessions (
          id,
          token,
          wallet_address,
          public_key,
          proof_level,
          telegram_binding,
          issued_at,
          expires_at,
          last_seen_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
      `,
      [
        session.id,
        session.token,
        session.walletAddress,
        session.publicKey,
        session.proofLevel,
        JSON.stringify(session.telegramBinding),
        session.issuedAt,
        session.expiresAt,
        session.lastSeenAt,
      ],
    );

    await client.query(
      `
        INSERT INTO audit_events (
          id,
          type,
          created_at,
          wallet_address,
          session_id,
          payload
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        auditEvent.id,
        auditEvent.type,
        auditEvent.createdAt,
        auditEvent.walletAddress,
        auditEvent.sessionId,
        JSON.stringify(auditEvent.payload || {}),
      ],
    );

    return session;
  });
}

async function getSessionByToken(token) {

  const result = await query(
    `
      SELECT *
      FROM wallet_sessions
      WHERE token = $1
        AND expires_at > NOW()
      LIMIT 1
    `,
    [token],
  );

  return normalizeSessionRow(result.rows[0]);
}

async function touchSession(token) {

  const result = await query(
    `
      UPDATE wallet_sessions
      SET last_seen_at = NOW()
      WHERE token = $1
        AND expires_at > NOW()
      RETURNING *
    `,
    [token],
  );

  return normalizeSessionRow(result.rows[0]);
}

async function revokeSession(token) {
  const result = await query(
    `
      DELETE FROM wallet_sessions
      WHERE token = $1
    `,
    [token],
  );

  return result.rowCount > 0;
}

async function createLaunchBundle({ launchTicket, auditEvent }) {
  return withTransaction(async (client) => {
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
          created_at,
          ipfs_hash,
          token_root_address,
          bonding_curve_address,
          deploy_status,
          deploy_reason
        ) VALUES (

          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8::jsonb,
          $9::jsonb,
          $10::jsonb,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16
        )

      `,
      [
        launchTicket.id,
        launchTicket.status,
        launchTicket.mintingAvailable,
        launchTicket.note,
        launchTicket.launchRequest.creator.wallet,
        true,
        false,
        JSON.stringify(launchTicket.launchRequest),
        JSON.stringify(launchTicket.treasuryPayment),
        JSON.stringify(launchTicket.riskProfile),
        launchTicket.createdAt,
        launchTicket.onchainData?.ipfsHash || null,
        launchTicket.onchainData?.tokenRootAddress || null,
        launchTicket.onchainData?.bondingCurveAddress || null,
        launchTicket.onchainData?.deployStatus || "pending",
        launchTicket.onchainData?.deployReason || "",
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
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11
        )
      `,
      [
        launchTicket.treasuryPayment.id,
        launchTicket.id,
        launchTicket.treasuryPayment.creatorWallet,
        launchTicket.treasuryPayment.txHash,
        launchTicket.treasuryPayment.tokenSymbol,
        launchTicket.treasuryPayment.amount,
        launchTicket.treasuryPayment.feeWallet,
        launchTicket.treasuryPayment.appFeeSharePercent,
        launchTicket.treasuryPayment.networkSettlementToken,
        launchTicket.treasuryPayment.networkSettlementStatus,
        launchTicket.treasuryPayment.recordedAt,
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
        launchTicket.riskProfile.id,
        launchTicket.id,
        launchTicket.riskProfile.creatorWallet,
        launchTicket.riskProfile.score,
        launchTicket.riskProfile.status,
        JSON.stringify(launchTicket.riskProfile.signals),
        launchTicket.riskProfile.createdAt,
      ],
    );

    await client.query(
      `
        INSERT INTO audit_events (
          id,
          type,
          created_at,
          wallet_address,
          launch_id,
          payload
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        auditEvent.id,
        auditEvent.type,
        auditEvent.createdAt,
        auditEvent.walletAddress,
        auditEvent.launchId,
        JSON.stringify(auditEvent.payload || {}),
      ],
    );

    return launchTicket;
  });
}

async function listLaunchesByWallet(walletAddress) {
  const result = await query(
    `
      SELECT *
      FROM launches
      WHERE wallet_address = $1
      ORDER BY created_at DESC
    `,
    [walletAddress],
  );

  return result.rows.map(normalizeLaunchRow);
}

async function listPublicLaunches(limit = 30) {
  // M-02: Only show tokens that are deployed or waiting for blockchain integration
  // Excludes draft, payment-failed, or other non-functional states from the public feed
  const result = await query(
    `
      SELECT *
      FROM launches
      WHERE is_public = TRUE
        AND status IN ('on_chain_deployed', 'payment_verified_waiting_blockchain_integration')
      ORDER BY
        CASE WHEN status = 'on_chain_deployed' THEN 0 ELSE 1 END,
        created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map(normalizeLaunchRow);
}

async function listLaunchesForSync(limit = 10) {
  const result = await query(
    `
      SELECT *
      FROM launches
      WHERE status IN ('on_chain_deployed', 'on_chain_pending_recovery')
        AND token_root_address IS NOT NULL
        AND bonding_curve_address IS NOT NULL
      ORDER BY onchain_updated_at ASC NULLS FIRST
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map(normalizeLaunchRow);
}

async function getLaunchById(id) {
  const result = await query(
    `SELECT * FROM launches WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows.length > 0 ? normalizeLaunchRow(result.rows[0]) : null;
}

async function listAllLaunches(limit = 500) {
  const safeLimit = Math.min(Math.max(1, limit), 500); // M-06: Enforce pagination limit
  const result = await query(
    `
      SELECT *
      FROM launches
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows.map(normalizeLaunchRow);
}

// ── Persistent rate limit & txHash dedup ─────────────────────────────────────

async function isTxHashUsed(txHash) {
  const result = await query(
    `SELECT 1 FROM used_tx_hashes WHERE tx_hash = $1 LIMIT 1`,
    [String(txHash || "").toLowerCase()],
  );
  return result.rows.length > 0;
}

async function markTxHashUsed(txHash, walletAddress) {
  await query(
    `INSERT INTO used_tx_hashes (tx_hash, wallet_address) VALUES ($1, $2) ON CONFLICT (tx_hash) DO NOTHING`,
    [String(txHash || "").toLowerCase(), String(walletAddress || "").toLowerCase()],
  );
}

async function reserveTxHash(txHash, walletAddress) {
  const result = await query(
    `INSERT INTO used_tx_hashes (tx_hash, wallet_address) VALUES ($1, $2) ON CONFLICT (tx_hash) DO NOTHING RETURNING tx_hash`,
    [String(txHash || "").toLowerCase(), String(walletAddress || "").toLowerCase()],
  );
  return result.rowCount > 0;
}

async function releaseTxHashReservation(txHash) {
  await query(
    `DELETE FROM used_tx_hashes WHERE tx_hash = $1`,
    [String(txHash || "").toLowerCase()],
  );
}

async function getWalletLastLaunch(walletAddress) {
  const result = await query(
    `SELECT last_launch_at FROM wallet_rate_limits WHERE wallet_address = $1 LIMIT 1`,
    [String(walletAddress || "").toLowerCase()],
  );
  return result.rows.length > 0 ? new Date(result.rows[0].last_launch_at) : null;
}

async function updateWalletLastLaunch(walletAddress) {
  await query(
    `INSERT INTO wallet_rate_limits (wallet_address, last_launch_at) VALUES ($1, NOW())
     ON CONFLICT (wallet_address) DO UPDATE SET last_launch_at = NOW()`,
    [String(walletAddress || "").toLowerCase()],
  );
}

async function createLaunchpadProject({ project, auditEvent }) {
  await withTransaction(async (client) => {
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
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18::jsonb,
          $19,
          $20
        )
      `,
      [
        project.id,
        project.slug,
        project.title,
        project.badge,
        project.shortDescription,
        project.description,
        project.logoUrl,
        project.coverImageUrl,
        project.rewardLabel,
        project.rewardToken,
        project.rewardAmount,
        project.participantLimit,
        project.sortOrder,
        project.status,
        project.startsAt,
        project.endsAt,
        project.createdBy,
        JSON.stringify(project.metadata || {}),
        project.createdAt,
        project.updatedAt,
      ],
    );

    await client.query(
      `
        INSERT INTO audit_events (
          id,
          type,
          created_at,
          wallet_address,
          payload
        ) VALUES ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        auditEvent.id,
        auditEvent.type,
        auditEvent.createdAt,
        auditEvent.walletAddress || null,
        JSON.stringify(auditEvent.payload || {}),
      ],
    );
  });

  return project;
}

async function createLaunchpadTask({ projectId, task, auditEvent }) {
  await withTransaction(async (client) => {
    const projectResult = await client.query(
      `
        SELECT id
        FROM launchpad_projects
        WHERE id = $1
        LIMIT 1
      `,
      [projectId],
    );

    if (projectResult.rowCount === 0) {
      throw new Error("Projeto exclusivo não encontrado.");
    }

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
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11::jsonb,
          $12,
          $13
        )
      `,
      [
        task.id,
        projectId,
        task.title,
        task.description,
        task.taskType,
        task.targetUrl,
        task.rewardPoints,
        task.rewardLabel,
        task.sortOrder,
        task.status,
        JSON.stringify(task.metadata || {}),
        task.createdAt,
        task.updatedAt,
      ],
    );

    await client.query(
      `
        INSERT INTO audit_events (
          id,
          type,
          created_at,
          wallet_address,
          payload
        ) VALUES ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        auditEvent.id,
        auditEvent.type,
        auditEvent.createdAt,
        auditEvent.walletAddress || null,
        JSON.stringify(auditEvent.payload || {}),
      ],
    );
  });

  return {
    ...task,
    projectId,
  };
}

async function createLaunchpadTaskSubmission({
  projectId,
  taskId,
  submission,
  auditEvent,
}) {
  return withTransaction(async (client) => {
    const taskResult = await client.query(
      `
        SELECT id, project_id
        FROM launchpad_tasks
        WHERE id = $1
        LIMIT 1
      `,
      [taskId],
    );

    if (taskResult.rowCount === 0) {
      throw new Error("Tarefa exclusiva não encontrada.");
    }

    const resolvedProjectId = taskResult.rows[0].project_id;

    if (projectId && projectId !== resolvedProjectId) {
      throw new Error("Projeto divergente da tarefa.");
    }

    const result = await client.query(
      `
        INSERT INTO launchpad_task_submissions (
          id,
          project_id,
          task_id,
          wallet_address,
          session_id,
          status,
          proof_text,
          proof_url,
          metadata,
          reviewed_at,
          reviewed_by,
          review_note,
          created_at,
          updated_at
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9::jsonb,
          NULL,
          '',
          '',
          $10,
          $11
        )
        ON CONFLICT (task_id, wallet_address)
        DO UPDATE SET
          session_id = EXCLUDED.session_id,
          status = EXCLUDED.status,
          proof_text = EXCLUDED.proof_text,
          proof_url = EXCLUDED.proof_url,
          metadata = EXCLUDED.metadata,
          reviewed_at = NULL,
          reviewed_by = '',
          review_note = '',
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `,
      [
        submission.id,
        resolvedProjectId,
        taskId,
        submission.walletAddress,
        submission.sessionId,
        submission.status,
        submission.proofText,
        submission.proofUrl,
        JSON.stringify(submission.metadata || {}),
        submission.createdAt,
        submission.updatedAt,
      ],
    );

    await client.query(
      `
        INSERT INTO audit_events (
          id,
          type,
          created_at,
          wallet_address,
          payload
        ) VALUES ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        auditEvent.id,
        auditEvent.type,
        auditEvent.createdAt,
        auditEvent.walletAddress || null,
        JSON.stringify(auditEvent.payload || {}),
      ],
    );

    return normalizeLaunchpadSubmissionRow(result.rows[0]);
  });
}

async function listPublicLaunchpadProjects(limit = 8) {
  const projectResult = await query(
    `
      SELECT *
      FROM launchpad_projects
      WHERE status = 'published'
      ORDER BY sort_order ASC, created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  const projects = projectResult.rows.map(normalizeLaunchpadProjectRow);

  if (projects.length === 0) {
    return [];
  }

  const projectIds = projects.map((project) => project.id);
  const [taskResult, projectMetricsResult, taskMetricsResult] = await Promise.all([
    query(
      `
        SELECT *
        FROM launchpad_tasks
        WHERE project_id = ANY($1::uuid[])
          AND status = 'active'
        ORDER BY sort_order ASC, created_at ASC
      `,
      [projectIds],
    ),
    query(
      `
        SELECT
          project_id,
          COUNT(*)::int AS submission_count,
          COUNT(DISTINCT wallet_address)::int AS participant_count
        FROM launchpad_task_submissions
        WHERE project_id = ANY($1::uuid[])
        GROUP BY project_id
      `,
      [projectIds],
    ),
    query(
      `
        SELECT
          task_id,
          COUNT(*)::int AS submission_count
        FROM launchpad_task_submissions
        WHERE project_id = ANY($1::uuid[])
        GROUP BY task_id
      `,
      [projectIds],
    ),
  ]);

  return attachLaunchpadRelations(
    projects,
    taskResult.rows.map(normalizeLaunchpadTaskRow),
    projectMetricsResult.rows.map((row) => ({
      projectId: row.project_id,
      submissionCount: row.submission_count,
      participantCount: row.participant_count,
    })),
    taskMetricsResult.rows.map((row) => ({
      taskId: row.task_id,
      submissionCount: row.submission_count,
    })),
  );
}

function buildViewerSubmissionSummary(submissions, taskCount) {
  return submissions.reduce(
    (summary, submission) => {
      summary.total += 1;

      if (submission.status === "approved") {
        summary.approved += 1;
      } else if (submission.status === "rejected") {
        summary.rejected += 1;
      } else if (submission.status === "under_review") {
        summary.underReview += 1;
      } else {
        summary.submitted += 1;
      }

      return summary;
    },
    {
      total: 0,
      approved: 0,
      rejected: 0,
      underReview: 0,
      submitted: 0,
      completionPercent:
        taskCount > 0
          ? Math.min(100, Math.round((submissions.length / taskCount) * 100))
          : 0,
    },
  );
}

async function getPublicLaunchpadProjectBySlug(slug, walletAddress = "") {
  const projectResult = await query(
    `
      SELECT *
      FROM launchpad_projects
      WHERE slug = $1
        AND status = 'published'
      LIMIT 1
    `,
    [slug],
  );

  if (projectResult.rowCount === 0) {
    return null;
  }

  const project = normalizeLaunchpadProjectRow(projectResult.rows[0]);
  const [taskResult, projectMetricsResult, taskMetricsResult, viewerSubmissionsResult] =
    await Promise.all([
      query(
        `
          SELECT *
          FROM launchpad_tasks
          WHERE project_id = $1
            AND status = 'active'
          ORDER BY sort_order ASC, created_at ASC
        `,
        [project.id],
      ),
      query(
        `
          SELECT
            project_id,
            COUNT(*)::int AS submission_count,
            COUNT(DISTINCT wallet_address)::int AS participant_count
          FROM launchpad_task_submissions
          WHERE project_id = $1
          GROUP BY project_id
        `,
        [project.id],
      ),
      query(
        `
          SELECT
            task_id,
            COUNT(*)::int AS submission_count
          FROM launchpad_task_submissions
          WHERE project_id = $1
          GROUP BY task_id
        `,
        [project.id],
      ),
      walletAddress
        ? query(
            `
              SELECT
                submissions.*,
                tasks.title AS task_title
              FROM launchpad_task_submissions AS submissions
              INNER JOIN launchpad_tasks AS tasks
                ON tasks.id = submissions.task_id
              WHERE submissions.project_id = $1
                AND submissions.wallet_address = $2
              ORDER BY submissions.updated_at DESC, submissions.created_at DESC
            `,
            [project.id, walletAddress],
          )
        : Promise.resolve({ rows: [] }),
    ]);

  const [projectWithRelations] = attachLaunchpadRelations(
    [project],
    taskResult.rows.map(normalizeLaunchpadTaskRow),
    projectMetricsResult.rows.map((row) => ({
      projectId: row.project_id,
      submissionCount: row.submission_count,
      participantCount: row.participant_count,
    })),
    taskMetricsResult.rows.map((row) => ({
      taskId: row.task_id,
      submissionCount: row.submission_count,
    })),
  );

  const viewerSubmissions = viewerSubmissionsResult.rows.map(normalizeLaunchpadSubmissionRow);
  const viewerSubmissionMap = new Map(
    viewerSubmissions.map((submission) => [submission.taskId, submission]),
  );
  const viewerSubmissionSummary = buildViewerSubmissionSummary(
    viewerSubmissions,
    projectWithRelations.taskCount,
  );

  return {
    project: {
      ...projectWithRelations,
      tasks: projectWithRelations.tasks.map((task) => ({
        ...task,
        mySubmission: viewerSubmissionMap.get(task.id) || null,
      })),
    },
    viewer: {
      authenticated: Boolean(walletAddress),
      walletAddress,
      submissions: viewerSubmissions,
      submissionSummary: viewerSubmissionSummary,
      lastSubmissionAt:
        viewerSubmissions[0]?.updatedAt || viewerSubmissions[0]?.createdAt || "",
    },
  };
}

async function listAdminLaunchpadProjects() {
  const projectResult = await query(
    `
      SELECT *
      FROM launchpad_projects
      ORDER BY sort_order ASC, created_at DESC
    `,
  );

  const projects = projectResult.rows.map(normalizeLaunchpadProjectRow);

  if (projects.length === 0) {
    return [];
  }

  const projectIds = projects.map((project) => project.id);
  const [taskResult, projectMetricsResult, taskMetricsResult] = await Promise.all([
    query(
      `
        SELECT *
        FROM launchpad_tasks
        WHERE project_id = ANY($1::uuid[])
        ORDER BY sort_order ASC, created_at ASC
      `,
      [projectIds],
    ),
    query(
      `
        SELECT
          project_id,
          COUNT(*)::int AS submission_count,
          COUNT(DISTINCT wallet_address)::int AS participant_count
        FROM launchpad_task_submissions
        WHERE project_id = ANY($1::uuid[])
        GROUP BY project_id
      `,
      [projectIds],
    ),
    query(
      `
        SELECT
          task_id,
          COUNT(*)::int AS submission_count
        FROM launchpad_task_submissions
        WHERE project_id = ANY($1::uuid[])
        GROUP BY task_id
      `,
      [projectIds],
    ),
  ]);

  return attachLaunchpadRelations(
    projects,
    taskResult.rows.map(normalizeLaunchpadTaskRow),
    projectMetricsResult.rows.map((row) => ({
      projectId: row.project_id,
      submissionCount: row.submission_count,
      participantCount: row.participant_count,
    })),
    taskMetricsResult.rows.map((row) => ({
      taskId: row.task_id,
      submissionCount: row.submission_count,
    })),
  );
}

async function listMyLaunchpadSubmissions(walletAddress) {
  const result = await query(
    `
      SELECT *
      FROM launchpad_task_submissions
      WHERE wallet_address = $1
      ORDER BY created_at DESC
    `,
    [walletAddress],
  );

  return result.rows.map(normalizeLaunchpadSubmissionRow);
}

async function listAdminLaunchpadSubmissions(limit = 200) {
  const result = await query(
    `
      SELECT
        submissions.*,
        projects.title AS project_title,
        tasks.title AS task_title
      FROM launchpad_task_submissions AS submissions
      INNER JOIN launchpad_projects AS projects
        ON projects.id = submissions.project_id
      INNER JOIN launchpad_tasks AS tasks
        ON tasks.id = submissions.task_id
      ORDER BY submissions.created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map(normalizeLaunchpadSubmissionRow);
}

async function updateLaunchpadProjectStatus({
  projectId,
  status,
  updatedBy,
  auditEvent,
}) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `
        UPDATE launchpad_projects
        SET
          status = $2,
          updated_at = NOW(),
          metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
        WHERE id = $1
        RETURNING *
      `,
      [
        projectId,
        status,
        JSON.stringify({
          lastStatusUpdatedBy: updatedBy,
          lastStatusUpdatedAt: new Date().toISOString(),
        }),
      ],
    );

    if (result.rowCount === 0) {
      throw new Error("Projeto exclusivo não encontrado.");
    }

    await client.query(
      `
        INSERT INTO audit_events (
          id,
          type,
          created_at,
          wallet_address,
          payload
        ) VALUES ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        auditEvent.id,
        auditEvent.type,
        auditEvent.createdAt,
        auditEvent.walletAddress || null,
        JSON.stringify(auditEvent.payload || {}),
      ],
    );

    return normalizeLaunchpadProjectRow(result.rows[0]);
  });
}

async function updateLaunchpadProjectContent({
  projectId,
  content,
  updatedBy,
  auditEvent,
}) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `
        UPDATE launchpad_projects
        SET
          slug = $2,
          title = $3,
          badge = $4,
          short_description = $5,
          description = $6,
          logo_url = $7,
          cover_image_url = $8,
          reward_label = $9,
          reward_token = $10,
          reward_amount = $11,
          participant_limit = $12,
          sort_order = $13,
          starts_at = $14,
          ends_at = $15,
          updated_at = NOW(),
          metadata = COALESCE(metadata, '{}'::jsonb) || $16::jsonb
        WHERE id = $1
        RETURNING *
      `,
      [
        projectId,
        content.slug,
        content.title,
        content.badge,
        content.shortDescription,
        content.description,
        content.logoUrl,
        content.coverImageUrl,
        content.rewardLabel,
        content.rewardToken,
        content.rewardAmount,
        content.participantLimit,
        content.sortOrder,
        content.startsAt,
        content.endsAt,
        JSON.stringify({
          lastContentUpdatedBy: updatedBy,
          lastContentUpdatedAt: new Date().toISOString(),
        }),
      ],
    );

    if (result.rowCount === 0) {
      throw new Error("Projeto exclusivo não encontrado.");
    }

    await client.query(
      `
        INSERT INTO audit_events (
          id,
          type,
          created_at,
          wallet_address,
          payload
        ) VALUES ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        auditEvent.id,
        auditEvent.type,
        auditEvent.createdAt,
        auditEvent.walletAddress || null,
        JSON.stringify(auditEvent.payload || {}),
      ],
    );

    return normalizeLaunchpadProjectRow(result.rows[0]);
  });
}

async function updateLaunchpadTaskStatus({
  taskId,
  status,
  updatedBy,
  auditEvent,
}) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `
        UPDATE launchpad_tasks
        SET
          status = $2,
          updated_at = NOW(),
          metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
        WHERE id = $1
        RETURNING *
      `,
      [
        taskId,
        status,
        JSON.stringify({
          lastStatusUpdatedBy: updatedBy,
          lastStatusUpdatedAt: new Date().toISOString(),
        }),
      ],
    );

    if (result.rowCount === 0) {
      throw new Error("Tarefa exclusiva não encontrada.");
    }

    await client.query(
      `
        INSERT INTO audit_events (
          id,
          type,
          created_at,
          wallet_address,
          payload
        ) VALUES ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        auditEvent.id,
        auditEvent.type,
        auditEvent.createdAt,
        auditEvent.walletAddress || null,
        JSON.stringify(auditEvent.payload || {}),
      ],
    );

    return normalizeLaunchpadTaskRow(result.rows[0]);
  });
}

async function updateLaunchpadTaskContent({
  taskId,
  content,
  updatedBy,
  auditEvent,
}) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `
        UPDATE launchpad_tasks
        SET
          title = $2,
          description = $3,
          task_type = $4,
          target_url = $5,
          reward_points = $6,
          reward_label = $7,
          sort_order = $8,
          updated_at = NOW(),
          metadata = COALESCE(metadata, '{}'::jsonb) || $9::jsonb
        WHERE id = $1
        RETURNING *
      `,
      [
        taskId,
        content.title,
        content.description,
        content.taskType,
        content.targetUrl,
        content.rewardPoints,
        content.rewardLabel,
        content.sortOrder,
        JSON.stringify({
          lastContentUpdatedBy: updatedBy,
          lastContentUpdatedAt: new Date().toISOString(),
        }),
      ],
    );

    if (result.rowCount === 0) {
      throw new Error("Tarefa exclusiva não encontrada.");
    }

    await client.query(
      `
        INSERT INTO audit_events (
          id,
          type,
          created_at,
          wallet_address,
          payload
        ) VALUES ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        auditEvent.id,
        auditEvent.type,
        auditEvent.createdAt,
        auditEvent.walletAddress || null,
        JSON.stringify(auditEvent.payload || {}),
      ],
    );

    return normalizeLaunchpadTaskRow(result.rows[0]);
  });
}

async function moderateLaunchpadSubmission({
  submissionId,
  status,
  reviewNote,
  reviewedBy,
  reviewedAt,
  auditEvent,
}) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `
        UPDATE launchpad_task_submissions
        SET
          status = $2,
          review_note = $3,
          reviewed_by = $4,
          reviewed_at = $5,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [submissionId, status, reviewNote, reviewedBy, reviewedAt],
    );

    if (result.rowCount === 0) {
      throw new Error("Submission não encontrada.");
    }

    await client.query(
      `
        INSERT INTO audit_events (
          id,
          type,
          created_at,
          wallet_address,
          payload
        ) VALUES ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        auditEvent.id,
        auditEvent.type,
        auditEvent.createdAt,
        auditEvent.walletAddress || null,
        JSON.stringify(auditEvent.payload || {}),
      ],
    );

    return normalizeLaunchpadSubmissionRow(result.rows[0]);
  });
}

async function getAdminOverview() {
  const [
    launchCount,
    sessionCount,
    treasuryCount,
    manualReviewCount,
    treasuryByToken,
    launchpadProjectCount,
    launchpadTaskCount,
    launchpadSubmissionCount,
    launchpadSubmissionStatusBreakdown,
  ] =
    await Promise.all([
      query("SELECT COUNT(*)::int AS count FROM launches"),
      query("SELECT COUNT(*)::int AS count FROM wallet_sessions WHERE expires_at > NOW()"),
      query("SELECT COUNT(*)::int AS count FROM treasury_payments"),
      query(
        "SELECT COUNT(*)::int AS count FROM risk_profiles WHERE status = 'manual_review'",
      ),
      query(
        `
          SELECT
            token_symbol,
            COUNT(*)::int AS count,
            COALESCE(SUM(amount), 0)::text AS total_amount
          FROM treasury_payments
          GROUP BY token_symbol
          ORDER BY token_symbol ASC
        `,
      ),
      query("SELECT COUNT(*)::int AS count FROM launchpad_projects"),
      query("SELECT COUNT(*)::int AS count FROM launchpad_tasks"),
      query("SELECT COUNT(*)::int AS count FROM launchpad_task_submissions"),
      query(
        `
          SELECT
            status,
            COUNT(*)::int AS count
          FROM launchpad_task_submissions
          GROUP BY status
          ORDER BY status ASC
        `,
      ),
    ]);

  return {
    launches: launchCount.rows[0]?.count || 0,
    activeSessions: sessionCount.rows[0]?.count || 0,
    treasuryPayments: treasuryCount.rows[0]?.count || 0,
    manualReviewCases: manualReviewCount.rows[0]?.count || 0,
    launchpadProjects: launchpadProjectCount.rows[0]?.count || 0,
    launchpadTasks: launchpadTaskCount.rows[0]?.count || 0,
    launchpadSubmissions: launchpadSubmissionCount.rows[0]?.count || 0,
    launchpadSubmissionStatusBreakdown: launchpadSubmissionStatusBreakdown.rows.map(
      (row) => ({
        status: row.status,
        count: row.count,
      }),
    ),
    treasuryByToken: treasuryByToken.rows.map((row) => ({
      tokenSymbol: row.token_symbol,
      count: row.count,
      totalAmount: Number(row.total_amount),
    })),
  };
}

// ─── Token Comments (Feature: Chat) ──────────────────────────────────────────

async function addComment(comment) {
  const sql = `
    INSERT INTO token_comments (id, launch_id, wallet_address, content, created_at)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const values = [
    comment.id,
    comment.launchId,
    comment.walletAddress,
    comment.content,
    comment.createdAt,
  ];
  
  const result = await query(sql, values);
  // Audit #18: Normalize to camelCase so frontend receives consistent keys
  // (walletAddress, createdAt) instead of raw PostgreSQL snake_case (wallet_address, created_at)
  const row = result.rows[0];
  return {
    id: row.id,
    launchId: row.launch_id,
    walletAddress: row.wallet_address,
    content: row.content,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  };
}

async function getCommentsByLaunchId(launchId, limit = 50) {
  const sql = `
    SELECT id, launch_id, wallet_address, content, created_at
    FROM token_comments
    WHERE launch_id = $1
    ORDER BY created_at DESC
    LIMIT $2;
  `;
  const result = await query(sql, [launchId, limit]);
  return result.rows.map(row => ({
    id: row.id,
    launchId: row.launch_id,
    walletAddress: row.wallet_address,
    content: row.content,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  }));
}

module.exports = {
  createAuthChallenge,
  createLaunchBundle,
  createLaunchpadProject,
  createLaunchpadTask,
  createLaunchpadTaskSubmission,
  consumeChallengeAndCreateSession,
  getAdminOverview,
  getPublicLaunchpadProjectBySlug,
  createSessionOnly,
  getSessionByToken,
  getUnusedChallengeById,
  listAdminLaunchpadProjects,
  listAdminLaunchpadSubmissions,
  listAllLaunches,
  listMyLaunchpadSubmissions,
  listLaunchesByWallet,
  listPublicLaunchpadProjects,
  listPublicLaunches,
  listLaunchesForSync,
  getLaunchById,

  isTxHashUsed,
  markTxHashUsed,
  reserveTxHash,
  releaseTxHashReservation,
  getWalletLastLaunch,
  updateWalletLastLaunch,
  moderateLaunchpadSubmission,
  updateLaunchpadProjectContent,
  revokeSession,
  touchSession,
  updateLaunchpadProjectStatus,
  updateLaunchpadTaskContent,
  updateLaunchpadTaskStatus,
  updateLaunchOnchainState,
  cleanupExpiredAuthData,
  addComment,
  getCommentsByLaunchId,
};

// ─── Trade History (Fita de Negociações) ─────────────────────────────────────

async function insertTrade(trade) {
  const sql = `
    INSERT INTO trades (id, launch_id, tx_hash, wallet_address, type, token_amount, shell_amount, price, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, NOW()))
    ON CONFLICT (tx_hash) DO NOTHING
    RETURNING *;
  `;
  const values = [
    trade.id,
    trade.launchId,
    trade.txHash,
    trade.walletAddress,
    trade.type,
    trade.tokenAmount,
    trade.shellAmount,
    trade.price,
    trade.createdAt || null
  ];
  
  const result = await query(sql, values);
  if (result.rows.length === 0) return null; // Já existia
  
  const row = result.rows[0];
  return {
    id: row.id,
    launchId: row.launch_id,
    txHash: row.tx_hash,
    walletAddress: row.wallet_address,
    type: row.type,
    tokenAmount: row.token_amount,
    shellAmount: row.shell_amount,
    price: row.price,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  };
}

async function getTradesByLaunchId(launchId, limit = 50) {
  const sql = `
    SELECT *
    FROM trades
    WHERE launch_id = $1
    ORDER BY created_at DESC
    LIMIT $2;
  `;
  const result = await query(sql, [launchId, limit]);
  return result.rows.map(row => ({
    id: row.id,
    launchId: row.launch_id,
    txHash: row.tx_hash,
    walletAddress: row.wallet_address,
    type: row.type,
    tokenAmount: row.token_amount,
    shellAmount: row.shell_amount,
    price: row.price,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  }));
}

async function getTopHoldersByLaunchId(launchId, limit = 20) {
  const sql = `
    SELECT 
      wallet_address,
      SUM(CASE WHEN type = 'buy' THEN token_amount ELSE 0 END) - SUM(CASE WHEN type = 'sell' THEN token_amount ELSE 0 END) as balance
    FROM trades
    WHERE launch_id = $1
    GROUP BY wallet_address
    HAVING SUM(CASE WHEN type = 'buy' THEN token_amount ELSE 0 END) - SUM(CASE WHEN type = 'sell' THEN token_amount ELSE 0 END) > 0
    ORDER BY balance DESC
    LIMIT $2;
  `;
  const result = await query(sql, [launchId, limit]);
  return result.rows.map(row => ({
    walletAddress: row.wallet_address,
    balance: Number(row.balance),
  }));
}

module.exports.insertTrade = insertTrade;
module.exports.getTradesByLaunchId = getTradesByLaunchId;
module.exports.getTopHoldersByLaunchId = getTopHoldersByLaunchId;
