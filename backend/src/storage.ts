import { query, withTransaction } from "./db";
import { LaunchTicket, Session, Trade, Comment } from "./types";

const USED_CHALLENGE_RETENTION_DAYS = 7;

export function normalizeChallengeRow(row: any) {
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

export function normalizeSessionRow(row: any): Session | null {
  if (!row) return null;
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

export function normalizeLaunchRow(row: any): LaunchTicket | null {
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




export async function updateLaunchOnchainState(
  launchId: any,
  { reserveBalance, tokenSupply, lockedLiquidity, status, deployStatus, deployReason, ipfsHash, tokenRootAddress, bondingCurveAddress }: any,
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
  
  if (ipfsHash !== undefined) {
    params.push(ipfsHash);
    sets.push(`ipfs_hash = $${params.length}`);
  }
  
  if (tokenRootAddress !== undefined) {
    params.push(tokenRootAddress);
    sets.push(`token_root_address = $${params.length}`);
  }
  
  if (bondingCurveAddress !== undefined) {
    params.push(bondingCurveAddress);
    sets.push(`bonding_curve_address = $${params.length}`);
  }

  params.push(launchId);
  const queryStr = `UPDATE launches SET ${sets.join(', ')} WHERE id = $${params.length}`;

  await query(queryStr, params);
}

export async function cleanupExpiredAuthData() {
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

  await query(
    `
      DELETE FROM used_tx_hashes
      WHERE used_at <= NOW() - INTERVAL '30 days'
    `
  );
}

export async function createAuthChallenge(challenge: any, auditEvent: any) {


  await withTransaction(async (client: any) => {
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

export async function getUnusedChallengeById(challengeId: any) {

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

export async function consumeChallengeAndCreateSession({
  challengeId,
  session,
  auditEvent,
}: any) {


  return withTransaction(async (client: any) => {
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

export async function createSessionOnly({ session, auditEvent }: any) {
  return withTransaction(async (client: any) => {
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

export async function touchSession(token: any) {

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

export async function revokeSession(token: any) {
  const result = await query(
    `
      DELETE FROM wallet_sessions
      WHERE token = $1
    `,
    [token],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function getSessionByToken(token: any) {
  const result = await query(
    `
      SELECT *
      FROM wallet_sessions
      WHERE token = $1
    `,
    [token],
  );

  return normalizeSessionRow(result.rows[0]);
}

export async function createLaunchBundle(params: { launchTicket: LaunchTicket; auditEvent: any }) {
  const { launchTicket, auditEvent } = params;
  return withTransaction(async (client: any) => {
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

export async function listLaunchesByWallet(walletAddress: any) {
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

export async function listPublicLaunches(limit: any = 30, offset: any = 0) {
  // M-02: Only show tokens that are deployed or waiting for blockchain integration
  // Excludes draft, payment-failed, or other non-functional states from the public feed
  const result = await query(
    `
      SELECT *
      FROM launches
      WHERE is_public = TRUE
        AND status IN ('on_chain_deployed', 'payment_verified_waiting_blockchain_integration', 'deployment_queued')
      ORDER BY
        CASE WHEN status = 'on_chain_deployed' THEN 0 ELSE 1 END,
        created_at DESC
      LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  );

  return result.rows.map(normalizeLaunchRow);
}

export async function listLaunchesForSync(limit: any = 10) {
  const result = await query(
    `
      SELECT *
      FROM launches
      WHERE status IN ('on_chain_deployed', 'on_chain_pending_recovery', 'deployment_queued')
        AND token_root_address IS NOT NULL
        AND bonding_curve_address IS NOT NULL
      ORDER BY onchain_updated_at ASC NULLS FIRST
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map(normalizeLaunchRow);
}

export async function getLaunchById(id: string): Promise<LaunchTicket | null> {
  const result = await query(
    `SELECT * FROM launches WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows.length > 0 ? normalizeLaunchRow(result.rows[0]) : null;
}

export async function listAllLaunches(limit: any = 500) {
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

export async function reserveTxHash(txHash: any, walletAddress: any) {
  const result = await query(
    `INSERT INTO used_tx_hashes (tx_hash, wallet_address) VALUES ($1, $2) ON CONFLICT (tx_hash) DO NOTHING RETURNING tx_hash`,
    [String(txHash || "").toLowerCase(), String(walletAddress || "").toLowerCase()],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function releaseTxHashReservation(txHash: any) {
  await query(
    `DELETE FROM used_tx_hashes WHERE tx_hash = $1`,
    [String(txHash || "").toLowerCase()],
  );
}

export async function getWalletLastLaunch(walletAddress: any) {
  const result = await query(
    `SELECT last_launch_at FROM wallet_rate_limits WHERE wallet_address = $1 LIMIT 1`,
    [String(walletAddress || "").toLowerCase()],
  );
  return result.rows.length > 0 ? new Date(result.rows[0].last_launch_at) : null;
}

export async function updateWalletLastLaunch(walletAddress: any) {
  await query(
    `INSERT INTO wallet_rate_limits (wallet_address, last_launch_at) VALUES ($1, NOW())
     ON CONFLICT (wallet_address) DO UPDATE SET last_launch_at = NOW()`,
    [String(walletAddress || "").toLowerCase()],
  );
}

// ─── Token Comments (Feature: Chat) ──────────────────────────────────────────

export async function addComment(comment: Comment) {
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

export async function getCommentsByLaunchId(launchId: any, limit: any = 50, offset: any = 0) {
  const sql = `
    SELECT id, launch_id, wallet_address, content, created_at
    FROM token_comments
    WHERE launch_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3;
  `;
  const result = await query(sql, [launchId, limit, offset]);
  return result.rows.map((row: any) => ({
    id: row.id,
    launchId: row.launch_id,
    walletAddress: row.wallet_address,
    content: row.content,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  }));
}

// ─── Trade History (Fita de Negociações) ─────────────────────────────────────

export async function insertTrade(trade: Trade) {
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

export async function getTradesByLaunchId(launchId: any, limit: any = 50, offset: any = 0) {
  const sql = `
    SELECT *
    FROM trades
    WHERE launch_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3;
  `;
  const result = await query(sql, [launchId, limit, offset]);
  return result.rows.map((row: any) => ({
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

export async function getTopHoldersByLaunchId(launchId: any, limit: any = 20) {
  const sql = `
    SELECT 
      wallet_address,
      SUM(CASE WHEN type = 'buy' THEN token_amount::NUMERIC ELSE 0 END) - SUM(CASE WHEN type = 'sell' THEN token_amount::NUMERIC ELSE 0 END) as balance
    FROM trades
    WHERE launch_id = $1
    GROUP BY wallet_address
    HAVING SUM(CASE WHEN type = 'buy' THEN token_amount::NUMERIC ELSE 0 END) - SUM(CASE WHEN type = 'sell' THEN token_amount::NUMERIC ELSE 0 END) > 0
    ORDER BY balance DESC
    LIMIT $2;
  `;
  const result = await query(sql, [launchId, limit]);
  return result.rows.map((row: any) => ({
    walletAddress: row.wallet_address,
    balance: String(row.balance),
  }));
}

export function escapeLikePattern(str: any) {
  return str.replace(/([%_\\])/g, '\\$1');
}

export async function searchLaunches(q: any, limit: any = 30, offset: any = 0) {
  const escapedQ = escapeLikePattern(String(q || ""));
  const sql = `
    SELECT * FROM launches
    WHERE (
      launch_request->'coin'->>'name' ILIKE $1 OR
      launch_request->'coin'->>'symbol' ILIKE $1 OR
      launch_request->'coin'->>'tagline' ILIKE $1 OR
      wallet_address ILIKE $1
    ) AND status IN ('on_chain_deployed', 'payment_verified_waiting_blockchain_integration', 'deployment_queued')
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3;
  `;
  const result = await query(sql, [`%${escapedQ}%`, limit, offset]);
  return result.rows.map(normalizeLaunchRow);
}

export async function addFavorite(walletAddress: any, launchId: any) {
  const sql = `
    INSERT INTO user_favorites (wallet_address, launch_id)
    VALUES ($1, $2)
    ON CONFLICT (wallet_address, launch_id) DO NOTHING
    RETURNING *;
  `;
  const result = await query(sql, [walletAddress.toLowerCase(), launchId]);
  return result.rows.length > 0;
}

export async function removeFavorite(walletAddress: any, launchId: any) {
  const sql = `
    DELETE FROM user_favorites
    WHERE wallet_address = $1 AND launch_id = $2
    RETURNING *;
  `;
  const result = await query(sql, [walletAddress.toLowerCase(), launchId]);
  return result.rows.length > 0;
}

export async function listFavorites(walletAddress: any) {
  const sql = `
    SELECT l.* FROM launches l
    JOIN user_favorites f ON l.id = f.launch_id
    WHERE f.wallet_address = $1
    ORDER BY f.created_at DESC;
  `;
  const result = await query(sql, [walletAddress.toLowerCase()]);
  return result.rows.map(normalizeLaunchRow);
}

export async function getPriceHistoryByLaunchId(launchId: any, intervalMinutes: any = 15) {
  const minutes = parseInt(String(intervalMinutes)) || 15;
  const sql = `
    SELECT
      time_bucket AS time,
      (array_agg(price::NUMERIC ORDER BY created_at ASC))[1] AS open,
      MAX(price::NUMERIC) AS high,
      MIN(price::NUMERIC) AS low,
      (array_agg(price::NUMERIC ORDER BY created_at DESC))[1] AS close,
      SUM(shell_amount::NUMERIC) AS volume
    FROM (
      SELECT
        date_trunc('minute', created_at) - (EXTRACT(minute FROM created_at)::INTEGER % $2) * interval '1 minute' AS time_bucket,
        price,
        shell_amount,
        created_at
      FROM trades
      WHERE launch_id = $1
    ) t
    GROUP BY time_bucket
    ORDER BY time_bucket ASC;
  `;
  const result = await query(sql, [launchId, minutes]);
  return result.rows.map((row: any) => ({
    time: row.time?.toISOString?.() || row.time,
    open: Number(row.open || 0),
    high: Number(row.high || 0),
    low: Number(row.low || 0),
    close: Number(row.close || 0),
    volume: Number(row.volume || 0) / 1e9,
  }));
}

export async function getGlobalStats() {
  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM launches) AS total_tokens,
      (SELECT COALESCE(SUM(reserve_balance), 0) FROM launches) AS total_reserve,
      (SELECT COUNT(DISTINCT wallet_address) FROM trades) AS active_wallets,
      (SELECT COUNT(*) FROM trades) AS total_trades
    FROM (SELECT 1) dummy;
  `;
  const result = await query(sql);
  const row = result.rows[0] || {};
  return {
    totalTokens: parseInt(row.total_tokens || 0),
    totalReserveShell: (Number(row.total_reserve || 0) / 1e9).toFixed(1),
    activeWallets: parseInt(row.active_wallets || 0),
    totalTrades: parseInt(row.total_trades || 0),
  };
}


