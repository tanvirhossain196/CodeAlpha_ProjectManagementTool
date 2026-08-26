import { asyncHandler, ok } from "../utils/api.js";
import * as comments from "../services/comment.service.js";
import { emitProject, emitUser } from "../services/realtime.service.js";

export const list=asyncHandler(async(req,res)=>ok(res,await comments.listComments(req.user.id,req.params.id),"Comments loaded."));
export const create=asyncHandler(async(req,res)=>{
  const data=await comments.createComment(req.user.id,req.params.id,req.body.body);
  emitProject(req.app.get("io"),data.projectId,"comment:created",data.comment);
  if(data.notification) emitUser(req.app.get("io"),data.notification.user_id,"notification:new",data.notification);
  ok(res,data.comment,"Comment added.",201);
});
export const update=asyncHandler(async(req,res)=>{
  const data=await comments.updateComment(req.user.id,req.params.id,req.body.body);
  emitProject(req.app.get("io"),data.projectId,"comment:updated",data.comment);
  ok(res,data.comment,"Comment updated.");
});
export const remove=asyncHandler(async(req,res)=>{
  const data=await comments.deleteComment(req.user.id,req.params.id);
  emitProject(req.app.get("io"),data.projectId,"comment:deleted",{id:data.id,taskId:data.taskId});
  ok(res,data,"Comment deleted.");
});
