import { asyncHandler, ok } from "../utils/api.js";
import * as tasks from "../services/task.service.js";
import { emitProject, emitUser } from "../services/realtime.service.js";

export const myList=asyncHandler(async(req,res)=>ok(res,await tasks.myTasks(req.user.id,req.query),"My tasks loaded."));
export const list=asyncHandler(async(req,res)=>ok(res,await tasks.listTasks(req.params.id,req.query),"Tasks loaded."));
export const get=asyncHandler(async(req,res)=>ok(res,await tasks.getTask(req.user.id,req.params.id),"Task loaded."));
export const create=asyncHandler(async(req,res)=>{
  const data=await tasks.createTask(req.user.id,req.params.id,req.body);
  emitProject(req.app.get("io"),req.params.id,"task:created",data.task);
  if(data.notification) emitUser(req.app.get("io"),data.notification.user_id,"notification:new",data.notification);
  ok(res,data.task,"Task created successfully.",201);
});
export const update=asyncHandler(async(req,res)=>{
  const data=await tasks.updateTask(req.user.id,req.params.id,req.body);
  emitProject(req.app.get("io"),data.task.project_id,"task:updated",data.task);
  if(data.notification) emitUser(req.app.get("io"),data.notification.user_id,"notification:new",data.notification);
  ok(res,data.task,"Task updated successfully.");
});
export const move=asyncHandler(async(req,res)=>{
  const data=await tasks.moveTask(req.user.id,req.params.id,req.body.status,req.body.sortOrder);
  emitProject(req.app.get("io"),data.task.project_id,"task:moved",data.task);
  if(data.notification) emitUser(req.app.get("io"),data.notification.user_id,"notification:new",data.notification);
  ok(res,data.task,"Task status updated.");
});
export const assign=asyncHandler(async(req,res)=>{
  const data=await tasks.assignTask(req.user.id,req.params.id,req.body.assigneeId);
  emitProject(req.app.get("io"),data.task.project_id,"task:assigned",data.task);
  if(data.notification) emitUser(req.app.get("io"),data.notification.user_id,"notification:new",data.notification);
  ok(res,data.task,"Task assignee updated.");
});
export const remove=asyncHandler(async(req,res)=>{
  const data=await tasks.deleteTask(req.user.id,req.params.id);
  emitProject(req.app.get("io"),data.projectId,"task:deleted",{id:data.id});
  ok(res,data,"Task deleted.");
});
export const activity=asyncHandler(async(req,res)=>ok(res,(await tasks.activity(req.user.id,req.params.id)).items,"Activity loaded."));
