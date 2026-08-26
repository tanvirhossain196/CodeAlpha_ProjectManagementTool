import { pool } from "../db/pool.js";

export async function logActivity({ projectId, taskId = null, actorId = null, action, metadata = {} }, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO activity_logs(project_id, task_id, actor_id, action, metadata)
     VALUES($1,$2,$3,$4,$5::jsonb) RETURNING *`,
    [projectId, taskId, actorId, action, JSON.stringify(metadata)]
  );
  return rows[0];
}
