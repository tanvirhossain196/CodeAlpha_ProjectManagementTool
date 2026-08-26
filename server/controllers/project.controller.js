import { asyncHandler, ok } from "../utils/api.js";
import * as projects from "../services/project.service.js";
import { emitProject, emitUser } from "../services/realtime.service.js";

export const list = asyncHandler(async (req,res)=>ok(res,await projects.listProjects(req.user.id),"Projects loaded."));
export const get = asyncHandler(async (req,res)=>ok(res,await projects.getProject(req.user.id,req.params.id),"Project loaded."));
export const star = asyncHandler(async (req,res)=>ok(
  res,
  await projects.setProjectStar(req.user.id,req.params.id,req.body.isStarred),
  req.body.isStarred?"Project added to priority list.":"Project removed from priority list."
));
export const create = asyncHandler(async (req,res)=>{
  const project=await projects.createProject(req.user.id,req.body);
  ok(res,project,"Project created successfully.",201);
});
export const update = asyncHandler(async (req,res)=>{
  const data=await projects.updateProject(req.user.id,req.params.id,req.body);
  emitProject(req.app.get("io"),req.params.id,"project:updated",data.project);
  for(const n of data.notifications) emitUser(req.app.get("io"),n.user_id,"notification:new",n);
  ok(res,data.project,"Project updated successfully.");
});
export const remove = asyncHandler(async (req,res)=>{
  const data=await projects.deleteProject(req.params.id);
  ok(res,data,"Project deleted successfully.");
});
export const members = asyncHandler(async (req,res)=>ok(res,await projects.listMembers(req.params.id),"Members loaded."));
export const addMember = asyncHandler(async (req,res)=>{
  const data=await projects.addMember(req.user.id,req.params.id,req.body);
  emitProject(req.app.get("io"),req.params.id,"member:added",data.member);
  emitUser(req.app.get("io"),data.member.id,"notification:new",data.notification);
  ok(res,data.member,"Member added successfully.",201);
});
export const updateMember = asyncHandler(async (req,res)=>{
  const data=await projects.updateMemberRole(req.user.id,req.params.id,req.params.userId,req.body.role);
  emitProject(req.app.get("io"),req.params.id,"member:updated",data);
  ok(res,data,"Member role updated.");
});
export const removeMember = asyncHandler(async (req,res)=>{
  const data=await projects.removeMember(req.user.id,req.params.id,req.params.userId);
  emitProject(req.app.get("io"),req.params.id,"member:removed",data);
  ok(res,data,"Member removed.");
});
