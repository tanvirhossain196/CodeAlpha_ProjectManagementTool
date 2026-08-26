import { pool } from "../db/pool.js";
import { AppError } from "../utils/api.js";
import { cleanText } from "../utils/security.js";
import { assertTaskAccess, roleRank } from "../middleware/projectAccess.js";
import { isDate } from "../validators/common.js";
import { logActivity } from "./activity.service.js";

export async function listEntries(userId, taskId) {
  const task = await assertTaskAccess(userId, taskId);
  const { rows } = await pool.query(
    `SELECT te.*,u.full_name user_name,u.avatar_url user_avatar
     FROM task_time_entries te
     JOIN users u ON u.id=te.user_id
     WHERE te.task_id=$1
     ORDER BY te.work_date DESC,te.created_at DESC`,
    [taskId]
  );
  return { projectId: task.project_id, entries: rows };
}

export async function createEntry(userId, taskId, payload) {
  const task = await assertTaskAccess(userId, taskId);
  const minutes = Number(payload.minutes);
  const note = cleanText(payload.note, 500);
  const workDate = payload.workDate || new Date().toISOString().slice(0, 10);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    throw new AppError("Logged time must be between 1 and 1440 minutes.", 422);
  }
  if (!isDate(workDate)) throw new AppError("Invalid work date.", 422);
  const { rows } = await pool.query(
    `INSERT INTO task_time_entries(task_id,user_id,minutes,note,work_date)
     VALUES($1,$2,$3,$4,$5)
     RETURNING *`,
    [taskId, userId, minutes, note, workDate]
  );
  await logActivity({
    projectId: task.project_id,
    taskId,
    actorId: userId,
    action: "WORK_LOGGED",
    metadata: { minutes }
  });
  return { projectId: task.project_id, entry: rows[0] };
}

export async function deleteEntry(userId, entryId) {
  const { rows } = await pool.query(
    `SELECT te.*,t.project_id,pm.role viewer_role
     FROM task_time_entries te
     JOIN tasks t ON t.id=te.task_id
     JOIN project_members pm ON pm.project_id=t.project_id AND pm.user_id=$1
     WHERE te.id=$2`,
    [userId, entryId]
  );
  const entry = rows[0];
  if (!entry) throw new AppError("Time entry not found or access denied.", 404);
  if (entry.user_id !== userId && roleRank[entry.viewer_role] < roleRank.ADMIN) {
    throw new AppError("You may only remove your own time entries.", 403);
  }
  await pool.query(`DELETE FROM task_time_entries WHERE id=$1`, [entryId]);
  await logActivity({
    projectId: entry.project_id,
    taskId: entry.task_id,
    actorId: userId,
    action: "WORK_LOG_REMOVED",
    metadata: { entryId, minutes: entry.minutes }
  });
  return { id: entryId, taskId: entry.task_id, projectId: entry.project_id };
}
