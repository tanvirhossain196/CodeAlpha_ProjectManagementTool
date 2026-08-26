import { asyncHandler, ok } from "../utils/api.js";
import { pool } from "../db/pool.js";

export const search=asyncHandler(async(req,res)=>{
  const q=String(req.query.q||"").trim().slice(0,100);
  if(q.length<2) return ok(res,{projects:[],tasks:[],users:[]},"Type at least 2 characters.");
  const like=`%${q}%`,uid=req.user.id;
  const [projects,tasks,users]=await Promise.all([
    pool.query(`SELECT p.id,p.name,p.status,p.project_code,p.client_name,'project' category
      FROM projects p JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$1
      WHERE p.name ILIKE $2 OR p.project_code ILIKE $2 OR p.client_name ILIKE $2 OR p.department ILIKE $2
      ORDER BY p.updated_at DESC LIMIT 8`,[uid,like]),
    pool.query(`SELECT t.id,t.title,t.status,t.project_id,p.name project_name,p.project_code,'task' category
      FROM tasks t JOIN projects p ON p.id=t.project_id
      JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$1
      WHERE t.title ILIKE $2 OR t.description ILIKE $2 OR p.name ILIKE $2 OR p.project_code ILIKE $2
      ORDER BY t.updated_at DESC LIMIT 10`,[uid,like]),
    pool.query(`SELECT DISTINCT u.id,u.full_name,u.username,u.job_title,u.department,'user' category
      FROM users u JOIN project_members mine ON mine.user_id=$1
      JOIN project_members theirs ON theirs.project_id=mine.project_id AND theirs.user_id=u.id
      WHERE u.full_name ILIKE $2 OR u.username ILIKE $2 OR u.job_title ILIKE $2 OR u.department ILIKE $2
      LIMIT 8`,[uid,like])
  ]);
  ok(res,{projects:projects.rows,tasks:tasks.rows,users:users.rows},"Search complete.");
});
