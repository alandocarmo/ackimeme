import * as express from 'express';
import { query } from './db';

const router = express.Router();

/**
 * Security module — real data from database.
 *
 * Previously this returned hardcoded mock data. Now it queries actual
 * risk_profiles and audit_events from the database. If no data exists,
 * it returns empty arrays — never fake data.
 */

// GET /admin/security/anomalies
// Returns risk profiles with high scores that need attention.
router.get('/anomalies', async (req: express.Request, res: express.Response) => {
  try {
    const result = await query(
      `
        SELECT
          rp.creator_wallet AS wallet,
          rp.status AS type,
          rp.score,
          rp.signals AS triggers,
          rp.created_at
        FROM risk_profiles rp
        WHERE rp.score >= 50
        ORDER BY rp.score DESC, rp.created_at DESC
        LIMIT 50
      `,
    );

    res.json({
      success: true,
      anomalies: result.rows.map((row: any) => ({
        wallet: row.wallet,
        type: row.type,
        score: row.score,
        triggers: row.triggers || [],
        detectedAt: row.created_at,
      })),
      source: 'database',
      note: result.rows.length === 0
        ? 'No high-risk profiles detected yet. Data populates as users create tokens.'
        : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/security/viral-ranking
// Returns tokens sorted by activity/risk score from actual launch data.
router.get('/viral-ranking', async (req: express.Request, res: express.Response) => {
  try {
    const result = await query(
      `
        SELECT
          l.id,
          l.launch_request->'coin'->>'name' AS name,
          l.launch_request->'coin'->>'symbol' AS symbol,
          l.status,
          l.created_at,
          rp.score AS risk_score,
          rp.status AS risk_status
        FROM launches l
        LEFT JOIN risk_profiles rp ON rp.launch_id = l.id
        WHERE l.is_public = TRUE
        ORDER BY rp.score DESC NULLS LAST, l.created_at DESC
        LIMIT 20
      `,
    );

    res.json({
      success: true,
      ranking: result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        symbol: row.symbol,
        riskScore: row.risk_score || 0,
        riskStatus: row.risk_status || 'unknown',
        createdAt: row.created_at,
      })),
      source: 'database',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
