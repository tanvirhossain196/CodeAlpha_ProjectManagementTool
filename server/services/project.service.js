import { pool } from "../db/pool.js";
import { AppError } from "../utils/api.js";
import { cleanText } from "../utils/security.js";
import { assert, PROJECT_STATUSES, PRIORITIES, MEMBER_ROLES, isDate } from "../validators/common.js";
import { logActivity } from "./activity.service.js";
import { createNotification } from "./notification.service.js";

const projectSelect = `
  SELECT p.*,
    pm.role AS viewer_role,
    pm.is_starred,
    u.full_name AS owner_name,
    COUNT(DISTINCT pm2.user_id)::int AS member_count,
    COUNT(DISTINCT t.id)::int AS task_count,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'DONE')::int AS completed_task_count
  FROM projects p
  JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
  JOIN users u ON u.id = p.owner_id
  LEFT JOIN project_members pm2 ON pm2.project_id = p.id
  LEFT JOIN tasks t ON t.project_id = p.id
`;

export async function listProjects(userId) {
  const { rows } = await pool.query(
    `${projectSelect}
     GROUP BY p.id, pm.role, pm.is_starred, u.full_name
     ORDER BY pm.is_starred DESC,p.updated_at DESC`, [userId]
  );
  return rows;
}

export async function getProject(userId, projectId) {
  const { rows } = await pool.query(
    `${projectSelect}
     WHERE p.id = $2
     GROUP BY p.id, pm.role, pm.is_starred, u.full_name`, [userId, projectId]
  );
  if (!rows[0]) throw new AppError("Project not found or access denied.", 404);
  return rows[0];
}

export async function createProject(userId, payload) {
  const name = cleanText(payload.name, 160);
  const description = cleanText(payload.description, 5000);
  const status = payload.status || "PLANNING";
  const priority = payload.priority || "MEDIUM";
  const projectCode = cleanText(payload.projectCode, 30).toUpperCase();
  const department = cleanText(payload.department, 100);
  const clientName = cleanText(payload.clientName, 140);
  assert(name.length >= 2, "Project name must be at least 2 characters.");
  assert(PROJECT_STATUSES.includes(status), "Invalid project status.");
  assert(PRIORITIES.includes(priority), "Invalid project priority.");
  assert(!projectCode || /^[A-Z0-9._\-/ ]+$/.test(projectCode), "Project code contains invalid characters.");
  assert(isDate(payload.startDate), "Invalid start date.");
  assert(isDate(payload.dueDate), "Invalid due date.");
  if (payload.startDate && payload.dueDate) {
    assert(new Date(payload.dueDate) >= new Date(payload.startDate), "Due date cannot be before start date.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO projects(name,description,status,priority,start_date,due_date,owner_id,project_code,department,client_name)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, description, status, priority, payload.startDate || null, payload.dueDate || null, userId, projectCode, department, clientName]
    );
    const project = rows[0];
    await client.query(
      `INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,'OWNER')`,
      [project.id, userId]
    );
    await logActivity({ projectId: project.id, actorId: userId, action: "PROJECT_CREATED", metadata: { name } }, client);
    await client.query("COMMIT");
    return { ...project, viewer_role: "OWNER", is_starred: false, member_count: 1, task_count: 0, completed_task_count: 0 };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateProject(userId, projectId, payload) {
  const current = await getProject(userId, projectId);
  const name = payload.name === undefined ? current.name : cleanText(payload.name, 160);
  const description = payload.description === undefined ? current.description : cleanText(payload.description, 5000);
  const status = payload.status ?? current.status;
  const priority = payload.priority ?? current.priority;
  const startDate = payload.startDate === undefined ? current.start_date : (payload.startDate || null);
  const dueDate = payload.dueDate === undefined ? current.due_date : (payload.dueDate || null);
  const projectCode = payload.projectCode === undefined ? current.project_code : cleanText(payload.projectCode, 30).toUpperCase();
  const department = payload.department === undefined ? current.department : cleanText(payload.department, 100);
  const clientName = payload.clientName === undefined ? current.client_name : cleanText(payload.clientName, 140);
  assert(name.length >= 2, "Project name must be at least 2 characters.");
  assert(PROJECT_STATUSES.includes(status), "Invalid project status.");
  assert(PRIORITIES.includes(priority), "Invalid project priority.");
  assert(!projectCode || /^[A-Z0-9._\-/ ]+$/.test(projectCode), "Project code contains invalid characters.");
  assert(isDate(startDate) && isDate(dueDate), "Invalid project date.");
  if (startDate && dueDate) assert(new Date(dueDate) >= new Date(startDate), "Due date cannot be before start date.");

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE projects SET name=$1,description=$2,status=$3,priority=$4,start_date=$5,due_date=$6,
        project_code=$7,department=$8,client_name=$9,updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [name, description, status, priority, startDate, dueDate, projectCode, department, clientName, projectId]
    );
    await logActivity({ projectId, actorId: userId, action: "PROJECT_UPDATED", metadata: { status, priority } },client);
    const recipients=await client.query(`SELECT user_id FROM project_members WHERE project_id=$1 AND user_id<>$2`,[projectId,userId]);
    const notifications=[];
    for(const member of recipients.rows){
      const n=await createNotification({
        userId:member.user_id,type:"PROJECT_UPDATED",title:"Project updated",
        message:`${name} was updated.`,projectId
      },client);
      if(n) notifications.push(n);
    }
    await client.query("COMMIT");
    return {project:rows[0],notifications};
  }catch(err){await client.query("ROLLBACK");throw err;}finally{client.release();}
}

export async function setProjectStar(userId, projectId, isStarred) {
  assert(typeof isStarred === "boolean", "isStarred must be a boolean value.");
  const { rows } = await pool.query(
    `UPDATE project_members SET is_starred=$1
     WHERE project_id=$2 AND user_id=$3 RETURNING is_starred`,
    [isStarred, projectId, userId]
  );
  if (!rows[0]) throw new AppError("Project not found or access denied.", 404);
  return rows[0];
}

export async function deleteProject(projectId) {
  const { rows } = await pool.query(`DELETE FROM projects WHERE id=$1 RETURNING id,name`, [projectId]);
  if (!rows[0]) throw new AppError("Project not found.", 404);
  return rows[0];
}

export async function listMembers(projectId) {
  const { rows } = await pool.query(
    `SELECT u.id,u.full_name,u.username,u.email,u.avatar_url,u.job_title,u.department,u.location,pm.role,pm.joined_at,
      COUNT(t.id) FILTER (WHERE t.status <> 'DONE')::int AS assigned_tasks
     FROM project_members pm
     JOIN users u ON u.id=pm.user_id
     LEFT JOIN tasks t ON t.project_id=pm.project_id AND t.assignee_id=u.id
     WHERE pm.project_id=$1
     GROUP BY u.id,pm.role,pm.joined_at
     ORDER BY CASE pm.role WHEN 'OWNER' THEN 1 WHEN 'ADMIN' THEN 2 ELSE 3 END, u.full_name`, [projectId]
  );
  return rows;
}

export async function addMember(actorId, projectId, payload) {
  const identity = String(payload.identity || "").trim().toLowerCase();
  const role = payload.role || "MEMBER";
  assert(identity, "Email or username is required.");
  assert(MEMBER_ROLES.includes(role) && role !== "OWNER", "Member role must be ADMIN or MEMBER.");
  const userResult = await pool.query(`SELECT id,full_name,username,email,avatar_url FROM users WHERE email=$1 OR username=$1`, [identity]);
  const user = userResult.rows[0];
  if (!user) throw new AppError("User not found.", 404);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,$3)
       ON CONFLICT(project_id,user_id) DO NOTHING RETURNING *`,
      [projectId, user.id, role]
    );
    if (!rows[0]) throw new AppError("User is already a project member.", 409);
    const notification = await createNotification({
      userId: user.id, type: "PROJECT_MEMBER_ADDED", title: "Added to project",
      message: "You were added to a ShilpoSetu project.", projectId
    }, client);
    await logActivity({ projectId, actorId, action: "MEMBER_ADDED", metadata: { userId: user.id, role } }, client);
    await client.query("COMMIT");
    return { member: { ...user, role, joined_at: rows[0].joined_at }, notification };
  } catch (err) {
    await client.query("ROLLBACK"); throw err;
  } finally { client.release(); }
}

export async function updateMemberRole(actorId, projectId, userId, role) {
  assert(["ADMIN","MEMBER"].includes(role), "Role must be ADMIN or MEMBER.");
  const current = await pool.query(`SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2`, [projectId,userId]);
  if (!current.rows[0]) throw new AppError("Member not found.", 404);
  if (current.rows[0].role === "OWNER") throw new AppError("Project owner role cannot be changed.", 409);
  const { rows } = await pool.query(
    `UPDATE project_members SET role=$1 WHERE project_id=$2 AND user_id=$3 RETURNING *`, [role,projectId,userId]
  );
  await logActivity({ projectId, actorId, action: "MEMBER_ROLE_CHANGED", metadata: { userId, role } });
  return rows[0];
}

export async function removeMember(actorId, projectId, userId) {
  const current = await pool.query(`SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2`, [projectId,userId]);
  if (!current.rows[0]) throw new AppError("Member not found.", 404);
  if (current.rows[0].role === "OWNER") throw new AppError("Project owner cannot be removed.", 409);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE tasks SET assignee_id=NULL,updated_at=NOW() WHERE project_id=$1 AND assignee_id=$2`, [projectId,userId]);
    await client.query(`DELETE FROM project_members WHERE project_id=$1 AND user_id=$2`, [projectId,userId]);
    await logActivity({ projectId, actorId, action: "MEMBER_REMOVED", metadata: { userId } }, client);
    await client.query("COMMIT");
    return { userId };
  } catch(err) {
    await client.query("ROLLBACK"); throw err;
  } finally { client.release(); }
}
