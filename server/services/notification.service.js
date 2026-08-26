import { pool } from "../db/pool.js";

export async function createNotification({ userId, type, title, message, projectId = null, taskId = null }, client = pool) {
  if (!userId) return null;
  const { rows } = await client.query(
    `INSERT INTO notifications(user_id,type,title,message,project_id,task_id)
     VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [userId, type, title, message, projectId, taskId]
  );
  return rows[0];
}
