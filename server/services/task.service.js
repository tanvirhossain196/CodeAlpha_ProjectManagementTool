import { pool } from "../db/pool.js";
import { AppError } from "../utils/api.js";
import { cleanText } from "../utils/security.js";
import {
  assert,
  TASK_STATUSES,
  PRIORITIES,
  isDate,
} from "../validators/common.js";
import { logActivity } from "./activity.service.js";
import { createNotification } from "./notification.service.js";
import { roleRank } from "../middleware/projectAccess.js";

function mutationAllowed(task, userId, action = "edit") {
  if (roleRank[task.viewer_role] >= roleRank.ADMIN) return true;
  if (action === "delete") return task.reporter_id === userId;
  return task.assignee_id === userId || task.reporter_id === userId;
}

async function validateAssignee(projectId, assigneeId, client = pool) {
  if (!assigneeId) return;
  const { rows } = await client.query(
    `SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2`,
    [projectId, assigneeId],
  );
  if (!rows[0]) throw new AppError("Assignee must be a project member.", 422);
}

export async function listTasks(projectId, query = {}) {
  const params = [projectId];
  const where = ["t.project_id=$1"];
  if (query.status && TASK_STATUSES.includes(query.status)) {
    params.push(query.status);
    where.push(`t.status=$${params.length}`);
  }
  if (query.priority && PRIORITIES.includes(query.priority)) {
    params.push(query.priority);
    where.push(`t.priority=$${params.length}`);
  }
  if (query.assignee) {
    params.push(query.assignee);
    where.push(`t.assignee_id=$${params.length}`);
  }
  if (query.due === "overdue")
    where.push(`t.due_date < CURRENT_DATE AND t.status <> 'DONE'`);
  if (query.due === "today") where.push(`t.due_date = CURRENT_DATE`);
  if (query.q) {
    params.push(`%${String(query.q).slice(0, 100)}%`);
    where.push(
      `(t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`,
    );
  }
  const sortMap = {
    priority:
      "CASE t.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END",
    due: "t.due_date NULLS LAST",
    created: "t.created_at",
    updated: "t.updated_at",
  };
  const sort = sortMap[query.sort] || "t.sort_order";
  const { rows } = await pool.query(
    `SELECT t.*,a.full_name assignee_name,a.avatar_url assignee_avatar,r.full_name reporter_name,
      COUNT(DISTINCT c.id)::int comment_count,
      COALESCE((SELECT SUM(te.minutes) FROM task_time_entries te WHERE te.task_id=t.id),0)::int logged_minutes,
      (SELECT COUNT(*) FROM task_checklist_items ci WHERE ci.task_id=t.id)::int checklist_total,
      (SELECT COUNT(*) FROM task_checklist_items ci WHERE ci.task_id=t.id AND ci.is_completed)::int checklist_done,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id',l.id,'name',l.name,'color',l.color))
        FILTER (WHERE l.id IS NOT NULL),'[]') labels
     FROM tasks t
     LEFT JOIN users a ON a.id=t.assignee_id
     JOIN users r ON r.id=t.reporter_id
     LEFT JOIN comments c ON c.task_id=t.id
     LEFT JOIN task_labels tl ON tl.task_id=t.id
     LEFT JOIN labels l ON l.id=tl.label_id
     WHERE ${where.join(" AND ")}
     GROUP BY t.id,a.full_name,a.avatar_url,r.full_name
     ORDER BY ${sort},t.created_at DESC`,
    params,
  );
  return rows;
}

export async function myTasks(userId, query = {}) {
  const params = [userId];
  const where = ["t.assignee_id=$1"];
  if (query.status && TASK_STATUSES.includes(query.status)) {
    params.push(query.status);
    where.push(`t.status=$${params.length}`);
  }
  if (query.priority && PRIORITIES.includes(query.priority)) {
    params.push(query.priority);
    where.push(`t.priority=$${params.length}`);
  }
  if (query.due === "overdue")
    where.push(`t.due_date<CURRENT_DATE AND t.status<>'DONE'`);
  if (query.due === "today") where.push(`t.due_date=CURRENT_DATE`);
  if (query.due === "week")
    where.push(
      `t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL '7 days'`,
    );
  if (query.q) {
    params.push(`%${String(query.q).trim().slice(0, 100)}%`);
    where.push(
      `(t.title ILIKE $${params.length} OR p.name ILIKE $${params.length})`,
    );
  }
  const sortMap = {
    priority:
      "CASE t.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END",
    due: "t.due_date NULLS LAST",
    updated: "t.updated_at DESC",
    project: "p.name",
  };
  const sort =
    sortMap[query.sort] ||
    "CASE WHEN t.status='DONE' THEN 2 ELSE 1 END,t.due_date NULLS LAST";
  const { rows } = await pool.query(
    `SELECT t.*,p.name project_name,p.project_code,r.full_name reporter_name,
      COUNT(DISTINCT c.id)::int comment_count,
      COALESCE((SELECT SUM(te.minutes) FROM task_time_entries te WHERE te.task_id=t.id),0)::int logged_minutes,
      (SELECT COUNT(*) FROM task_checklist_items ci WHERE ci.task_id=t.id)::int checklist_total,
      (SELECT COUNT(*) FROM task_checklist_items ci WHERE ci.task_id=t.id AND ci.is_completed)::int checklist_done,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id',l.id,'name',l.name,'color',l.color))
        FILTER(WHERE l.id IS NOT NULL),'[]') labels
     FROM tasks t
     JOIN projects p ON p.id=t.project_id
     JOIN project_members pm ON pm.project_id=t.project_id AND pm.user_id=$1
     JOIN users r ON r.id=t.reporter_id
     LEFT JOIN comments c ON c.task_id=t.id
     LEFT JOIN task_labels tl ON tl.task_id=t.id
     LEFT JOIN labels l ON l.id=tl.label_id
     WHERE ${where.join(" AND ")}
     GROUP BY t.id,p.id,r.full_name
     ORDER BY ${sort},t.created_at DESC`,
    params,
  );
  return rows;
}

export async function getTask(userId, taskId) {
  const { rows } = await pool.query(
    `SELECT t.*,pm.role viewer_role,a.full_name assignee_name,r.full_name reporter_name,p.name project_name,p.project_code,
      COALESCE((SELECT SUM(te.minutes) FROM task_time_entries te WHERE te.task_id=t.id),0)::int logged_minutes,
      (SELECT COUNT(*) FROM task_checklist_items ci WHERE ci.task_id=t.id)::int checklist_total,
      (SELECT COUNT(*) FROM task_checklist_items ci WHERE ci.task_id=t.id AND ci.is_completed)::int checklist_done,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id',l.id,'name',l.name,'color',l.color))
        FILTER (WHERE l.id IS NOT NULL),'[]') labels
     FROM tasks t
     JOIN projects p ON p.id=t.project_id
     JOIN project_members pm ON pm.project_id=t.project_id AND pm.user_id=$1
     LEFT JOIN users a ON a.id=t.assignee_id
     JOIN users r ON r.id=t.reporter_id
     LEFT JOIN task_labels tl ON tl.task_id=t.id
     LEFT JOIN labels l ON l.id=tl.label_id
     WHERE t.id=$2
     GROUP BY t.id,pm.role,a.full_name,r.full_name,p.id`,
    [userId, taskId],
  );
  if (!rows[0]) throw new AppError("Task not found or access denied.", 404);
  return rows[0];
}

export async function createTask(userId, projectId, payload) {
  const title = cleanText(payload.title, 200),
    description = cleanText(payload.description, 10000);
  const status = payload.status || "BACKLOG",
    priority = payload.priority || "MEDIUM";
  const estimatedMinutes = Number(payload.estimatedMinutes || 0);
  assert(title.length >= 2, "Task title must be at least 2 characters.");
  assert(TASK_STATUSES.includes(status), "Invalid task status.");
  assert(PRIORITIES.includes(priority), "Invalid task priority.");
  assert(
    Number.isInteger(estimatedMinutes) &&
      estimatedMinutes >= 0 &&
      estimatedMinutes <= 100000,
    "Estimated time is invalid.",
  );
  assert(isDate(payload.dueDate), "Invalid due date.");
  await validateAssignee(projectId, payload.assigneeId || null);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const orderRes = await client.query(
      `SELECT COALESCE(MAX(sort_order),0)+100 next_order FROM tasks WHERE project_id=$1 AND status=$2`,
      [projectId, status],
    );
    const { rows } = await client.query(
      `INSERT INTO tasks(
    project_id,
    title,
    description,
    reporter_id,
    assignee_id,
    status,
    priority,
    due_date,
    sort_order,
    estimated_minutes,
    completed_at
  )
  VALUES(
    $1,
    $2,
    $3,
    $4,
    $5,
    $6::task_status,
    $7::priority_level,
    $8,
    $9,
    $10,
    CASE
      WHEN $6::task_status = 'DONE'::task_status
      THEN NOW()
      ELSE NULL
    END
  )
  RETURNING *`,
      [
        projectId,
        title,
        description,
        userId,
        payload.assigneeId || null,
        status,
        priority,
        payload.dueDate || null,
        orderRes.rows[0].next_order,
        estimatedMinutes,
      ],
    );
    const task = rows[0];
    await syncLabels(client, task.id, projectId, payload.labels || []);
    await logActivity(
      {
        projectId,
        taskId: task.id,
        actorId: userId,
        action: "TASK_CREATED",
        metadata: { title },
      },
      client,
    );
    let notification = null;
    if (task.assignee_id && task.assignee_id !== userId) {
      notification = await createNotification(
        {
          userId: task.assignee_id,
          type: "TASK_ASSIGNED",
          title: "New task assigned",
          message: title,
          projectId,
          taskId: task.id,
        },
        client,
      );
    }
    await client.query("COMMIT");
    return { task: await getTask(userId, task.id), notification };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function syncLabels(client, taskId, projectId, labels) {
  if (!Array.isArray(labels)) return;
  await client.query(`DELETE FROM task_labels WHERE task_id=$1`, [taskId]);
  for (const raw of labels.slice(0, 8)) {
    const name = cleanText(typeof raw === "string" ? raw : raw.name, 40);
    if (!name) continue;
    const color =
      typeof raw === "object" && /^#[0-9A-Fa-f]{6}$/.test(raw.color || "")
        ? raw.color
        : "#334155";
    const { rows } = await client.query(
      `INSERT INTO labels(project_id,name,color) VALUES($1,$2,$3)
       ON CONFLICT(project_id,name) DO UPDATE SET color=EXCLUDED.color RETURNING id`,
      [projectId, name, color],
    );
    await client.query(
      `INSERT INTO task_labels(task_id,label_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
      [taskId, rows[0].id],
    );
  }
}

export async function updateTask(userId, taskId, payload) {
  const current = await getTask(userId, taskId);
  if (!mutationAllowed(current, userId))
    throw new AppError(
      "You may only update tasks you report or are assigned to.",
      403,
    );
  const title =
    payload.title === undefined ? current.title : cleanText(payload.title, 200);
  const description =
    payload.description === undefined
      ? current.description
      : cleanText(payload.description, 10000);
  const status = payload.status ?? current.status,
    priority = payload.priority ?? current.priority;
  const dueDate =
    payload.dueDate === undefined ? current.due_date : payload.dueDate || null;
  const assigneeId =
    payload.assigneeId === undefined
      ? current.assignee_id
      : payload.assigneeId || null;
  const estimatedMinutes =
    payload.estimatedMinutes === undefined
      ? Number(current.estimated_minutes || 0)
      : Number(payload.estimatedMinutes);
  assert(title.length >= 2, "Task title must be at least 2 characters.");
  assert(TASK_STATUSES.includes(status), "Invalid task status.");
  assert(PRIORITIES.includes(priority), "Invalid task priority.");
  assert(isDate(dueDate), "Invalid due date.");
  assert(
    Number.isInteger(estimatedMinutes) &&
      estimatedMinutes >= 0 &&
      estimatedMinutes <= 100000,
    "Estimated time is invalid.",
  );
  await validateAssignee(current.project_id, assigneeId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE tasks SET title=$1,description=$2,status=$3,priority=$4,due_date=$5,assignee_id=$6,
        estimated_minutes=$7,completed_at=CASE WHEN $3='DONE' THEN COALESCE(completed_at,NOW()) ELSE NULL END,updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [
        title,
        description,
        status,
        priority,
        dueDate,
        assigneeId,
        estimatedMinutes,
        taskId,
      ],
    );
    if (payload.labels !== undefined)
      await syncLabels(client, taskId, current.project_id, payload.labels);
    const changes = {};
    for (const [key, oldVal, newVal] of [
      ["status", current.status, status],
      ["priority", current.priority, priority],
      ["assigneeId", current.assignee_id, assigneeId],
    ]) {
      if (oldVal !== newVal) changes[key] = { from: oldVal, to: newVal };
    }
    await logActivity(
      {
        projectId: current.project_id,
        taskId,
        actorId: userId,
        action: "TASK_UPDATED",
        metadata: changes,
      },
      client,
    );
    let notification = null;
    if (
      assigneeId &&
      assigneeId !== current.assignee_id &&
      assigneeId !== userId
    ) {
      notification = await createNotification(
        {
          userId: assigneeId,
          type: "TASK_ASSIGNED",
          title: "Task assigned to you",
          message: title,
          projectId: current.project_id,
          taskId,
        },
        client,
      );
    }
    if (!notification && status !== current.status) {
      const recipient =
        current.reporter_id !== userId
          ? current.reporter_id
          : assigneeId !== userId
            ? assigneeId
            : null;
      if (recipient)
        notification = await createNotification(
          {
            userId: recipient,
            type: "TASK_STATUS_CHANGED",
            title: "Task status changed",
            message: `${title}: ${current.status} → ${status}`,
            projectId: current.project_id,
            taskId,
          },
          client,
        );
    }
    await client.query("COMMIT");
    return { task: await getTask(userId, taskId), notification };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function moveTask(userId, taskId, status, sortOrder) {
  assert(TASK_STATUSES.includes(status), "Invalid task status.");
  const current = await getTask(userId, taskId);
  if (!mutationAllowed(current, userId))
    throw new AppError(
      "You may only move tasks you report or are assigned to.",
      403,
    );
  let order = Number(sortOrder);
  if (!Number.isInteger(order) || order < 0 || order > 2147483647) {
    const next = await pool.query(
      `SELECT COALESCE(MAX(sort_order),0)+100 next_order FROM tasks WHERE project_id=$1 AND status=$2`,
      [current.project_id, status],
    );
    order = next.rows[0].next_order;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE tasks SET status=$1,sort_order=$2,
       completed_at=CASE WHEN $1='DONE' THEN COALESCE(completed_at,NOW()) ELSE NULL END,updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [status, order, taskId],
    );
    await logActivity(
      {
        projectId: current.project_id,
        taskId,
        actorId: userId,
        action: "TASK_MOVED",
        metadata: { from: current.status, to: status },
      },
      client,
    );
    const recipient =
      current.reporter_id !== userId
        ? current.reporter_id
        : current.assignee_id !== userId
          ? current.assignee_id
          : null;
    let notification = null;
    if (recipient && current.status !== status) {
      notification = await createNotification(
        {
          userId: recipient,
          type: "TASK_STATUS_CHANGED",
          title: "Task status changed",
          message: `${current.title}: ${current.status} → ${status}`,
          projectId: current.project_id,
          taskId,
        },
        client,
      );
    }
    await client.query("COMMIT");
    return { task: rows[0], previousStatus: current.status, notification };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function assignTask(userId, taskId, assigneeId) {
  return updateTask(userId, taskId, { assigneeId });
}

export async function deleteTask(userId, taskId) {
  const current = await getTask(userId, taskId);
  if (!mutationAllowed(current, userId, "delete"))
    throw new AppError("You are not allowed to delete this task.", 403);
  await pool.query(`DELETE FROM tasks WHERE id=$1`, [taskId]);
  await logActivity({
    projectId: current.project_id,
    actorId: userId,
    action: "TASK_DELETED",
    metadata: { taskId, title: current.title },
  });
  return { id: taskId, projectId: current.project_id };
}

export async function activity(userId, taskId) {
  const task = await getTask(userId, taskId);
  const { rows } = await pool.query(
    `SELECT al.*,u.full_name actor_name FROM activity_logs al LEFT JOIN users u ON u.id=al.actor_id
     WHERE al.task_id=$1 ORDER BY al.created_at DESC LIMIT 100`,
    [taskId],
  );
  return { projectId: task.project_id, items: rows };
}
