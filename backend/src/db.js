const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { config } = require("./config");

const migrationsDir = path.join(__dirname, "migrations");

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
  max: 20, // max connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Audit #29: 2s was too short for Render free tier cold starts
});

pool.on("error", (err) => {
  console.error("[Database] Unexpected error on idle client:", err.message);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function withTransaction(handler) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations() {
  const result = await query("SELECT version FROM schema_migrations");
  return new Set(result.rows.map((row) => row.version));
}

async function applyMigration(version, sql) {
  await withTransaction(async (client) => {
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING",
      [version],
    );
  });
}

async function runMigrations() {
  await ensureMigrationsTable();
  const appliedMigrations = await getAppliedMigrations();
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (appliedMigrations.has(file)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    await applyMigration(file, sql);
  }
}

// Audit #29: Added retry logic for cold-start resilience
async function pingDatabase(retries = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await query("SELECT 1");
      return true;
    } catch (err) {
      console.warn(`[Database] Ping attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        throw err;
      }
    }
  }
}

module.exports = {
  pingDatabase,
  pool,
  query,
  runMigrations,
  withTransaction,
};
