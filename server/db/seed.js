import { pool } from "./pool.js";
try {
  await pool.query("SELECT 1");
  console.log("Database connection is healthy. Create users through /api/auth/register.");
} finally {
  await pool.end();
}
