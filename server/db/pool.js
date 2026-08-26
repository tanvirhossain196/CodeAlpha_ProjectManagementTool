import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;
export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.nodeEnv === "production" ? { rejectUnauthorized: false } : false,
  max: 15,
  idleTimeoutMillis: 30000
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error", err);
});
