import { pool } from "../db/pool.js";
import { AppError } from "../utils/api.js";
import { cleanText } from "../utils/security.js";
import { assertTaskAccess } from "../middleware/projectAccess.js";
import { logActivity } from "./activity.service.js";

export async function listItems(userId, taskId) {
  const task = await assertTaskAccess(userId, taskId);
  const { rows } = await pool.query(
    `SELECT ci.*,u.full_name creator_name
     FROM task_checklist_items ci
     LEFT JOIN users u ON u.id=ci.created_by
     WHERE ci.task_id=$1
     ORDER BY ci.sort_order,ci.created_at`,
    [taskId]
  );
  return { projectId: task.project_id, items: rows };
}

export async function createItem(userId, taskId, payload) {
  const task = await assertTaskAccess(userId, taskId);
  const content = cleanText(payload.content, 240);
  if (!content) throw new AppError("Checklist item cannot be empty.", 422);
  const order = await pool.query(
    `SELECT COALESCE(MAX(sort_order),0)+100 next_order FROM task_checklist_items WHERE task_id=$1`,
    [taskId]
  );
  const { rows } = await pool.query(
    `INSERT INTO task_checklist_items(task_id,content,sort_order,created_by)
     VALUES($1,$2,$3,$4) RETURNING *`,
    [taskId, content, order.rows[0].next_order, userId]
  );
  await logActivity({
    projectId: task.project_id,
    taskId,
    actorId: userId,
    action: "CHECKLIST_ITEM_ADDED",
    metadata: { itemId: rows[0].id }
  });
  return { projectId: task.project_id, item: rows[0] };
}

async function findItem(userId, itemId) {
  const { rows } = await pool.query(
    `SELECT ci.*,t.project_id,pm.role viewer_role
     FROM task_checklist_items ci
     JOIN tasks t ON t.id=ci.task_id
     JOIN project_members pm ON pm.project_id=t.project_id AND pm.user_id=$1
     WHERE ci.id=$2`,
    [userId, itemId]
  );
  if (!rows[0]) throw new AppError("Checklist item not found or access denied.", 404);
  return rows[0];
}

export async function updateItem(userId, itemId, payload) {
  const current = await findItem(userId, itemId);
  const content = payload.content === undefined ? current.content : cleanText(payload.content, 240);
  if (!content) throw new AppError("Checklist item cannot be empty.", 422);
  const completed = payload.isCompleted === undefined ? current.is_completed : Boolean(payload.isCompleted);
  const { rows } = await pool.query(
    `UPDATE task_checklist_items
     SET content=$1,is_completed=$2,updated_at=NOW()
     WHERE id=$3 RETURNING *`,
    [content, completed, itemId]
  );
  await logActivity({
    projectId: current.project_id,
    taskId: current.task_id,
    actorId: userId,
    action: completed && !current.is_completed ? "CHECKLIST_ITEM_COMPLETED" : "CHECKLIST_ITEM_UPDATED",
    metadata: { itemId }
  });
  return { projectId: current.project_id, item: rows[0] };
}

export async function deleteItem(userId, itemId) {
  const current = await findItem(userId, itemId);
  await pool.query(`DELETE FROM task_checklist_items WHERE id=$1`, [itemId]);
  await logActivity({
    projectId: current.project_id,
    taskId: current.task_id,
    actorId: userId,
    action: "CHECKLIST_ITEM_REMOVED",
    metadata: { itemId }
  });
  return { id: itemId, taskId: current.task_id, projectId: current.project_id };
}
