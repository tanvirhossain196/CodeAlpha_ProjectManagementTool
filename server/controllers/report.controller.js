import { asyncHandler, ok } from "../utils/api.js";
import { pool } from "../db/pool.js";

export const overview = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const [projects, taskStats, timeStats, health, workload, statusMix, priorityMix] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int total_projects,
        COUNT(*) FILTER (WHERE p.status='ACTIVE')::int active_projects,
        COUNT(*) FILTER (WHERE p.due_date<CURRENT_DATE AND p.status NOT IN ('COMPLETED','ARCHIVED'))::int delayed_projects
       FROM projects p
       JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$1`,
      [userId]
    ),
    pool.query(
      `SELECT COUNT(t.id)::int total_tasks,
        COUNT(t.id) FILTER (WHERE t.status='DONE')::int completed_tasks,
        COUNT(t.id) FILTER (WHERE t.status<>'DONE' AND t.due_date<CURRENT_DATE)::int overdue_tasks,
        COUNT(t.id) FILTER (WHERE t.status<>'DONE' AND t.priority='CRITICAL')::int critical_open,
        COALESCE(SUM(t.estimated_minutes),0)::int estimated_minutes
       FROM tasks t
       JOIN project_members pm ON pm.project_id=t.project_id AND pm.user_id=$1`,
      [userId]
    ),
    pool.query(
      `SELECT COALESCE(SUM(te.minutes),0)::int logged_minutes
       FROM task_time_entries te
       JOIN tasks t ON t.id=te.task_id
       JOIN project_members pm ON pm.project_id=t.project_id AND pm.user_id=$1`,
      [userId]
    ),
    pool.query(
      `SELECT p.id,p.name,p.project_code,p.status,p.priority,p.due_date,pm.is_starred,
        COUNT(t.id)::int task_count,
        COUNT(t.id) FILTER (WHERE t.status='DONE')::int completed_count,
        COUNT(t.id) FILTER (WHERE t.status<>'DONE' AND t.due_date<CURRENT_DATE)::int overdue_count,
        COALESCE(SUM(t.estimated_minutes),0)::int estimated_minutes,
        COALESCE((SELECT SUM(te.minutes) FROM task_time_entries te
          JOIN tasks wt ON wt.id=te.task_id WHERE wt.project_id=p.id),0)::int logged_minutes
       FROM projects p
       JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$1
       LEFT JOIN tasks t ON t.project_id=p.id
       GROUP BY p.id,pm.is_starred
       ORDER BY pm.is_starred DESC,
        CASE WHEN COUNT(t.id)=0 THEN 0 ELSE COUNT(t.id) FILTER (WHERE t.status='DONE')::numeric/COUNT(t.id) END ASC,
        p.due_date NULLS LAST
       LIMIT 20`,
      [userId]
    ),
    pool.query(
      `SELECT u.id,u.full_name,u.avatar_url,u.job_title,u.department,
        COUNT(t.id) FILTER (WHERE t.status<>'DONE')::int open_tasks,
        COUNT(t.id) FILTER (WHERE t.status<>'DONE' AND t.due_date<CURRENT_DATE)::int overdue_tasks,
        COUNT(t.id) FILTER (WHERE t.status<>'DONE' AND t.priority='CRITICAL')::int critical_tasks,
        COALESCE(SUM(t.estimated_minutes) FILTER (WHERE t.status<>'DONE'),0)::int remaining_estimate,
        COALESCE((SELECT SUM(te.minutes) FROM task_time_entries te
          JOIN tasks wt ON wt.id=te.task_id
          JOIN project_members scope ON scope.project_id=wt.project_id AND scope.user_id=$1
          WHERE te.user_id=u.id AND te.work_date>=date_trunc('month',CURRENT_DATE)::date),0)::int logged_this_month
       FROM users u
       JOIN project_members member ON member.user_id=u.id
       JOIN project_members mine ON mine.project_id=member.project_id AND mine.user_id=$1
       LEFT JOIN tasks t ON t.project_id=member.project_id AND t.assignee_id=u.id
       GROUP BY u.id
       ORDER BY overdue_tasks DESC,critical_tasks DESC,open_tasks DESC,u.full_name
       LIMIT 16`,
      [userId]
    ),
    pool.query(
      `SELECT t.status,COUNT(*)::int count
       FROM tasks t JOIN project_members pm ON pm.project_id=t.project_id AND pm.user_id=$1
       GROUP BY t.status`,
      [userId]
    ),
    pool.query(
      `SELECT t.priority,COUNT(*)::int count
       FROM tasks t JOIN project_members pm ON pm.project_id=t.project_id AND pm.user_id=$1
       WHERE t.status<>'DONE' GROUP BY t.priority`,
      [userId]
    )
  ]);

  const task = taskStats.rows[0] || {};
  const total = Number(task.total_tasks || 0);
  const completed = Number(task.completed_tasks || 0);
  ok(res, {
    summary: {
      ...(projects.rows[0] || {}),
      ...task,
      ...(timeStats.rows[0] || {}),
      completion_percentage: total ? Math.round((completed / total) * 100) : 0
    },
    projectHealth: health.rows,
    workload: workload.rows,
    statusMix: statusMix.rows,
    priorityMix: priorityMix.rows
  }, "Operational report loaded.");
});
