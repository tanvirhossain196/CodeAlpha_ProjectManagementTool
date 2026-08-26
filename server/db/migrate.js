import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { pool } from "./pool.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, "../../database/migrations");
const files = (await readdir(migrationsDir))
  .filter((file) => file.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

const client = await pool.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const applied = await client.query(`SELECT filename FROM schema_migrations`);
  const completed = new Set(applied.rows.map((row) => row.filename));
  for (const file of files) {
    if (completed.has(file)) {
      console.log(`Already applied: ${file}`);
      continue;
    }
    const sql = await readFile(resolve(migrationsDir, file), "utf8");
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(`INSERT INTO schema_migrations(filename) VALUES($1)`, [file]);
      await client.query("COMMIT");
      console.log(`Applied migration: ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  console.log("ShilpoSetu database migrations complete.");
} finally {
  client.release();
  await pool.end();
}
