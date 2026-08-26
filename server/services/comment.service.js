import { pool } from "../db/pool.js";
import { AppError } from "../utils/api.js";
import { cleanText } from "../utils/security.js";
import { assertTaskAccess } from "../middleware/projectAccess.js";
import { logActivity } from "./activity.service.js";
import { createNotification } from "./notification.service.js";

export async function listComments(userId,taskId){
  await assertTaskAccess(userId,taskId);
  const {rows}=await pool.query(
    `SELECT c.*,u.full_name author_name,u.username author_username,u.avatar_url author_avatar
     FROM comments c JOIN users u ON u.id=c.author_id
     WHERE c.task_id=$1 ORDER BY c.created_at ASC`,[taskId]
  );
  return rows;
}

export async function createComment(userId,taskId,body){
  const task=await assertTaskAccess(userId,taskId);
  const text=cleanText(body,5000);
  if(!text) throw new AppError("Comment cannot be empty.",422);
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const {rows}=await client.query(
      `INSERT INTO comments(task_id,author_id,body) VALUES($1,$2,$3) RETURNING *`,[taskId,userId,text]
    );
    await logActivity({projectId:task.project_id,taskId,actorId:userId,action:"COMMENT_ADDED",metadata:{commentId:rows[0].id}},client);
    const recipient=task.assignee_id && task.assignee_id!==userId?task.assignee_id:(task.reporter_id!==userId?task.reporter_id:null);
    let notification=null;
    if(recipient){
      notification=await createNotification({userId:recipient,type:"TASK_COMMENT",title:"New task comment",message:text.slice(0,160),projectId:task.project_id,taskId},client);
    }
    await client.query("COMMIT");
    const full=await pool.query(
      `SELECT c.*,u.full_name author_name,u.username author_username,u.avatar_url author_avatar
       FROM comments c JOIN users u ON u.id=c.author_id WHERE c.id=$1`,[rows[0].id]
    );
    return {comment:full.rows[0],projectId:task.project_id,notification};
  }catch(err){await client.query("ROLLBACK");throw err;}finally{client.release();}
}

export async function updateComment(userId,commentId,body){
  const text=cleanText(body,5000);
  if(!text) throw new AppError("Comment cannot be empty.",422);
  const {rows:found}=await pool.query(
    `SELECT c.*,t.project_id FROM comments c JOIN tasks t ON t.id=c.task_id
     JOIN project_members pm ON pm.project_id=t.project_id AND pm.user_id=$1 WHERE c.id=$2`,[userId,commentId]
  );
  const comment=found[0];
  if(!comment) throw new AppError("Comment not found.",404);
  if(comment.author_id!==userId) throw new AppError("You can only edit your own comments.",403);
  const {rows}=await pool.query(
    `UPDATE comments SET body=$1,edited_at=NOW(),updated_at=NOW() WHERE id=$2 RETURNING *`,[text,commentId]
  );
  await logActivity({projectId:comment.project_id,taskId:comment.task_id,actorId:userId,action:"COMMENT_EDITED",metadata:{commentId}});
  return {comment:rows[0],projectId:comment.project_id};
}

export async function deleteComment(userId,commentId){
  const {rows:found}=await pool.query(
    `SELECT c.*,t.project_id FROM comments c JOIN tasks t ON t.id=c.task_id
     JOIN project_members pm ON pm.project_id=t.project_id AND pm.user_id=$1 WHERE c.id=$2`,[userId,commentId]
  );
  const comment=found[0];
  if(!comment) throw new AppError("Comment not found.",404);
  if(comment.author_id!==userId) throw new AppError("You can only delete your own comments.",403);
  await pool.query(`DELETE FROM comments WHERE id=$1`,[commentId]);
  await logActivity({projectId:comment.project_id,taskId:comment.task_id,actorId:userId,action:"COMMENT_DELETED",metadata:{commentId}});
  return {id:commentId,taskId:comment.task_id,projectId:comment.project_id};
}
