import { pool } from "../db/pool.js";
import { AppError } from "../utils/api.js";

export const roleRank = { MEMBER: 1, ADMIN: 2, OWNER: 3 };

export function requireProjectRole(minRole = "MEMBER", idSource = "params") {
  return async (req, _res, next) => {
    try {
      const projectId = idSource === "body" ? req.body.projectId : (req.params.id || req.params.projectId);
      if (!projectId) throw new AppError("Project id is required.", 400);
      const { rows } = await pool.query(
        `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
        [projectId, req.user.id]
      );
      const membership = rows[0];
      if (!membership) throw new AppError("You are not a member of this project.", 403);
      if (roleRank[membership.role] < roleRank[minRole]) {
        throw new AppError("You are not authorized to perform this action.", 403);
      }
      req.projectRole = membership.role;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export async function assertTaskAccess(userId, taskId, minRole = "MEMBER") {
  const { rows } = await pool.query(
    `SELECT t.*, pm.role AS viewer_role
     FROM tasks t
     JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = $1
     WHERE t.id = $2`,
    [userId, taskId]
  );
  const task = rows[0];
  if (!task) throw new AppError("Task not found or access denied.", 404);
  if (roleRank[task.viewer_role] < roleRank[minRole]) {
    throw new AppError("You are not authorized to perform this action.", 403);
  }
  return task;
}
