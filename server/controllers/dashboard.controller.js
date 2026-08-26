import { asyncHandler, ok } from "../utils/api.js";
import { pool } from "../db/pool.js";

export const summary=asyncHandler(async(req,res)=>{
  const uid=req.user.id;
  const [stats,projects,deadlines,activity,distribution,focus,capacity]=await Promise.all([
    pool.query(
      `SELECT
        COUNT(DISTINCT pm.project_id)::int total_projects,
        COUNT(DISTINCT pm.project_id) FILTER (WHERE p.status='ACTIVE')::int active_projects,
        COUNT(DISTINCT t.id) FILTER (WHERE t.assignee_id=$1 AND t.status<>'DONE')::int my_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE t.assignee_id=$1 AND t.status<>'DONE' AND t.due_date<CURRENT_DATE)::int overdue_tasks,
        COUNT(DISTINCT t.id) FILTER (WHERE t.assignee_id=$1 AND t.status='DONE')::int completed_tasks,
        COUNT(DISTINCT pm2.user_id)::int team_members
       FROM project_members pm JOIN projects p ON p.id=pm.project_id
       LEFT JOIN project_members pm2 ON pm2.project_id=pm.project_id
       LEFT JOIN tasks t ON t.project_id=pm.project_id
       WHERE pm.user_id=$1`,[uid]),
    pool.query(
      `SELECT p.id,p.name,p.description,p.project_code,p.client_name,p.status,p.priority,p.due_date,pm.is_starred,
        COUNT(t.id)::int task_count,COUNT(t.id) FILTER(WHERE t.status='DONE')::int done_count
       FROM projects p JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$1
       LEFT JOIN tasks t ON t.project_id=p.id
       GROUP BY p.id,pm.is_starred ORDER BY pm.is_starred DESC,p.updated_at DESC LIMIT 5`,[uid]),
    pool.query(
      `SELECT t.id,t.title,t.due_date,t.priority,p.name project_name
       FROM tasks t JOIN projects p ON p.id=t.project_id JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$1
       WHERE t.assignee_id=$1 AND t.status<>'DONE' AND t.due_date IS NOT NULL
       ORDER BY t.due_date ASC LIMIT 8`,[uid]),
    pool.query(
      `SELECT al.*,u.full_name actor_name,p.name project_name
       FROM activity_logs al JOIN project_members pm ON pm.project_id=al.project_id AND pm.user_id=$1
       LEFT JOIN users u ON u.id=al.actor_id JOIN projects p ON p.id=al.project_id
       ORDER BY al.created_at DESC LIMIT 10`,[uid]),
    pool.query(
      `SELECT t.status,COUNT(*)::int count FROM tasks t
       JOIN project_members pm ON pm.project_id=t.project_id AND pm.user_id=$1 GROUP BY t.status`,[uid])
    ,pool.query(
      `SELECT t.id,t.title,t.status,t.priority,t.due_date,t.estimated_minutes,p.name project_name,p.project_code
       FROM tasks t JOIN projects p ON p.id=t.project_id
       JOIN project_members pm ON pm.project_id=t.project_id AND pm.user_id=$1
       WHERE t.assignee_id=$1 AND t.status<>'DONE'
       ORDER BY CASE WHEN t.due_date<CURRENT_DATE THEN 0 ELSE 1 END,
        CASE t.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
        t.due_date NULLS LAST LIMIT 6`,[uid])
    ,pool.query(
      `SELECT
        COUNT(t.id) FILTER(WHERE t.status<>'DONE')::int open_tasks,
        COALESCE(SUM(t.estimated_minutes) FILTER(WHERE t.status<>'DONE'),0)::int remaining_estimate,
        COALESCE((SELECT SUM(te.minutes) FROM task_time_entries te
          WHERE te.user_id=$1 AND te.work_date>=CURRENT_DATE-INTERVAL '6 days'),0)::int logged_this_week
       FROM tasks t WHERE t.assignee_id=$1`,[uid])
  ]);
  const s=stats.rows[0]||{};
  const totalOwned=Number(s.completed_tasks||0)+Number(s.my_tasks||0);
  s.completion_percentage=totalOwned?Math.round(Number(s.completed_tasks)*100/totalOwned):0;
  ok(res,{stats:s,recentProjects:projects.rows,upcomingDeadlines:deadlines.rows,
    recentActivity:activity.rows,taskDistribution:distribution.rows,focusTasks:focus.rows,
    personalCapacity:capacity.rows[0]||{open_tasks:0,remaining_estimate:0,logged_this_week:0}},"Dashboard loaded.");
});
