import { asyncHandler, ok, AppError } from "../utils/api.js";
import { pool } from "../db/pool.js";

export const list=asyncHandler(async(req,res)=>{
  await pool.query(
    `INSERT INTO notifications(user_id,type,title,message,project_id,task_id)
     SELECT t.assignee_id,'DEADLINE_APPROACHING','Task deadline approaching',
       t.title || ' is due ' || to_char(t.due_date,'Mon DD'),t.project_id,t.id
     FROM tasks t
     JOIN project_members pm ON pm.project_id=t.project_id AND pm.user_id=t.assignee_id
     WHERE t.assignee_id=$1 AND t.status<>'DONE'
       AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL '2 days'
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.user_id=$1 AND n.task_id=t.id AND n.type='DEADLINE_APPROACHING'
           AND n.created_at>NOW()-INTERVAL '24 hours'
       )`,[req.user.id]
  );
  const {rows}=await pool.query(
    `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,[req.user.id]
  );
  ok(res,rows,"Notifications loaded.");
});
export const unreadCount=asyncHandler(async(req,res)=>{
  const {rows}=await pool.query(
    `SELECT COUNT(*)::int count FROM notifications WHERE user_id=$1 AND is_read=FALSE`,
    [req.user.id]
  );
  ok(res,rows[0]||{count:0},"Unread notification count loaded.");
});
export const read=asyncHandler(async(req,res)=>{
  const {rows}=await pool.query(
    `UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2 RETURNING *`,[req.params.id,req.user.id]
  );
  if(!rows[0]) throw new AppError("Notification not found.",404);
  ok(res,rows[0],"Notification marked as read.");
});
export const readAll=asyncHandler(async(req,res)=>{
  await pool.query(`UPDATE notifications SET is_read=TRUE WHERE user_id=$1 AND is_read=FALSE`,[req.user.id]);
  ok(res,null,"All notifications marked as read.");
});
