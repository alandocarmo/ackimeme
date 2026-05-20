import * as fs from "fs";
import * as path from "path";
import { Pool, PoolClient, QueryResult } from "pg";
import { config } from "./config";

const migrationsDir = path.join(__dirname, "migrations");

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_VERIFY === "true" } : false,
  max: parseInt(process.env.DB_POOL_MAX || "5", 10), // max connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Audit #29: 2s was too short for Render free tier cold starts
  statement_timeout: 10000, // Prevent rogue long-running queries
});

pool.on("error", (err: Error) => {
  console.error("[Database] Unexpected error on idle client:", err.message);
});

export async function query(text: string, params: any[] = []): Promise<QueryResult> {
  return pool.query(text, params);
}

export async function withTransaction<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
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

async function ensureMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await query("SELECT version FROM schema_migrations");
  return new Set(result.rows.map((row: any) => row.version));
}

async function applyMigration(version: string, sql: string): Promise<void> {
  await withTransaction(async (client: PoolClient) => {
    await client.query("SET LOCAL statement_timeout = 0");
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING",
      [version],
    );
  });
}

export async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();
  const appliedMigrations = await getAppliedMigrations();
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file: string) => file.endsWith(".sql"))
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
export async function pingDatabase(retries = 3, delayMs = 2000): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await query("SELECT 1");
      return true;
    } catch (err: any) {
      console.warn(`[Database] Ping attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        throw err;
      }
    }
  }
  return false;
}
