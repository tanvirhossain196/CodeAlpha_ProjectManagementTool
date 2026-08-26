import {get,post,put,patch,del} from "./api.js";
import {boot} from "./app.js";
import {getStoredUser} from "./auth.js";
import {escapeHtml,fmtDate,fmtDuration,initials,modal,setButtonLoading,timeAgo,toast} from "./ui.js";
import {joinProject,on} from "./socket.js";
import {mountTaskExtras} from "./task-extras.js";

await boot();
const currentUser=getStoredUser();
const projectId=new URLSearchParams(location.search).get("id");
if(!projectId){location.replace("/projects.html");await new Promise(()=>{});}
const STATUSES=["BACKLOG","TODO","IN_PROGRESS","IN_REVIEW","DONE"];
let project,members=[],tasks=[],filters={};

function taskCard(t){
  return `<article class="task-card" draggable="true" data-task="${t.id}" tabindex="0">
    <span class="badge ${String(t.priority).toLowerCase()}">${escapeHtml(t.priority)}</span>
    <div class="task-card-title">${escapeHtml(t.title)}</div>
    <div class="task-card-desc">${escapeHtml(t.description||"No description")}</div>
    <div class="task-card-labels">${(t.labels||[]).map(l=>`<span class="label-dot">${escapeHtml(l.name)}</span>`).join("")}</div>
    <div class="task-card-progress"><span>☑ ${t.checklist_done||0}/${t.checklist_total||0}</span><span>◷ ${fmtDuration(t.logged_minutes||0)}${t.estimated_minutes?` / ${fmtDuration(t.estimated_minutes)}`:""}</span></div>
    <div class="task-card-foot"><span>${t.assignee_name?`👤 ${escapeHtml(t.assignee_name)}`:"Unassigned"}</span><span>${t.due_date?`📅 ${fmtDate(t.due_date)}`:""}</span></div>
    <div class="task-card-foot"><span>💬 ${t.comment_count||0}</span><span class="status-dot"></span></div></article>`;
}
function render(){
  for(const s of STATUSES){
    const list=document.querySelector(`[data-status="${s}"] .task-list`);const filtered=tasks.filter(t=>t.status===s);
    list.innerHTML=filtered.length?filtered.map(taskCard).join(""):`<div class="empty" style="padding:18px 8px;background:transparent">No tasks</div>`;
    document.querySelector(`[data-status="${s}"] [data-count]`).textContent=filtered.length;
  }
  bindCards();
}
function bindCards(){
  document.querySelectorAll(".task-card").forEach(card=>{
    card.addEventListener("click",()=>openTask(card.dataset.task));
    card.addEventListener("keydown",e=>{if(e.key==="Enter")openTask(card.dataset.task)});
    card.addEventListener("dragstart",()=>card.classList.add("dragging"));
    card.addEventListener("dragend",()=>card.classList.remove("dragging"));
  });
}
async function loadTasks(){
  const p=new URLSearchParams();
  for(const [k,v] of Object.entries(filters))if(v)p.set(k,v);
  try{tasks=await get(`/projects/${projectId}/tasks?${p}`);render();}
  catch(err){toast(err.message,"error");}
}
async function loadAll(){
  [project,members]=await Promise.all([get(`/projects/${projectId}`),get(`/projects/${projectId}/members`)]);
  document.querySelector("#projectName").textContent=project.name;document.querySelector("#projectDescription").textContent=project.description||"No description";
  document.querySelector("#projectRole").textContent=project.viewer_role;
  document.querySelector("#memberCount").textContent=members.length;
  const projectCode=document.querySelector("#projectCode");if(projectCode)projectCode.textContent=project.project_code||"GENERAL";
  const projectClient=document.querySelector("#projectClient");if(projectClient)projectClient.textContent=project.client_name||"Internal operation";
  const projectDepartment=document.querySelector("#projectDepartment");if(projectDepartment)projectDepartment.textContent=project.department||"Cross-functional";
  const projectDue=document.querySelector("#projectDue");if(projectDue)projectDue.textContent=fmtDate(project.due_date);
  const teamLink=document.querySelector("#manageTeamLink");if(teamLink)teamLink.href=`/team.html?project=${encodeURIComponent(projectId)}`;
  const star=document.querySelector("#starProject");if(star){star.classList.toggle("active",project.is_starred);star.setAttribute("aria-pressed",String(Boolean(project.is_starred)));star.textContent=project.is_starred?"★ Priority project":"☆ Add to priority";}
  document.querySelector("#editProject").classList.toggle("hidden",!["OWNER","ADMIN"].includes(project.viewer_role));
  fillAssigneeFilter();await loadTasks();joinProject(projectId);
}
function fillAssigneeFilter(){
  const select=document.querySelector("#assigneeFilter");
  const selected=filters.assignee||"";
  select.innerHTML=`<option value="">All assignees</option>`+members.map(m=>`<option value="${m.id}" ${String(m.id)===String(selected)?"selected":""}>${escapeHtml(m.full_name)}</option>`).join("");
}
for(const id of ["statusFilter","priorityFilter","assigneeFilter","sortFilter"]){
  document.querySelector(`#${id}`)?.addEventListener("change",e=>{const key={statusFilter:"status",priorityFilter:"priority",assigneeFilter:"assignee",sortFilter:"sort"}[id];filters[key]=e.target.value;loadTasks();});
}
let searchTimer;document.querySelector("#boardSearch")?.addEventListener("input",e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{filters.q=e.target.value.trim();loadTasks();},260);});
document.querySelector("#clearFilters")?.addEventListener("click",()=>{filters={};document.querySelectorAll(".board-toolbar select").forEach(s=>s.value="");const search=document.querySelector("#boardSearch");if(search)search.value="";loadTasks();});

document.querySelectorAll(".task-list").forEach(list=>{
  list.addEventListener("dragover",e=>{e.preventDefault();list.closest(".kanban-col").classList.add("drop-target")});
  list.addEventListener("dragleave",()=>list.closest(".kanban-col").classList.remove("drop-target"));
  list.addEventListener("drop",async e=>{
    e.preventDefault();list.closest(".kanban-col").classList.remove("drop-target");
    const card=document.querySelector(".task-card.dragging");if(!card)return;
    const task=tasks.find(x=>String(x.id)===card.dataset.task);if(!task)return;const old=task.status;const next=list.closest(".kanban-col").dataset.status;if(old===next)return;
    task.status=next;render();
    try{await patch(`/tasks/${task.id}/status`,{status:next});toast("Task moved.","success");}
    catch(err){task.status=old;render();toast(err.message,"error");}
  });
});

function taskForm(task={}){
  return `<form id="taskForm" class="form-grid">
    <div class="form-group" style="grid-column:1/-1"><label>Title</label><input class="input" name="title" maxlength="200" required value="${escapeHtml(task.title||"")}"></div>
    <div class="form-group" style="grid-column:1/-1"><label>Description</label><textarea class="textarea" name="description">${escapeHtml(task.description||"")}</textarea></div>
    <div class="form-group"><label>Status</label><select class="select" name="status">${STATUSES.map(s=>`<option ${task.status===s?"selected":""}>${s}</option>`).join("")}</select></div>
    <div class="form-group"><label>Priority</label><select class="select" name="priority">${["LOW","MEDIUM","HIGH","CRITICAL"].map(s=>`<option ${task.priority===s?"selected":""}>${s}</option>`).join("")}</select></div>
    <div class="form-group"><label>Assignee</label><select class="select" name="assigneeId"><option value="">Unassigned</option>${members.map(m=>`<option value="${m.id}" ${task.assignee_id===m.id?"selected":""}>${escapeHtml(m.full_name)}</option>`).join("")}</select></div>
    <div class="form-group"><label>Due date</label><input class="input" type="date" name="dueDate" value="${task.due_date?String(task.due_date).slice(0,10):""}"></div>
    <div class="form-group"><label>Estimated hours</label><input class="input" type="number" name="estimatedHours" min="0" max="1666" step="0.25" value="${task.estimated_minutes?Number(task.estimated_minutes)/60:""}" placeholder="8"></div>
    <div class="form-group" style="grid-column:1/-1"><label>Labels (comma separated)</label><input class="input" name="labels" value="${escapeHtml((task.labels||[]).map(x=>x.name).join(", "))}"></div>
    <div style="grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px"><button class="btn btn-secondary" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">${task.id?"Save changes":"Create task"}</button></div>
  </form>`;
}

document.querySelector("#editProject")?.addEventListener("click",()=>{
  const m=modal({title:"Project settings",body:`<form id="projectSettingsForm" class="form-grid">
    <div class="form-group" style="grid-column:1/-1"><label>Project name</label><input class="input" name="name" required value="${escapeHtml(project.name)}"></div>
    <div class="form-group" style="grid-column:1/-1"><label>Description</label><textarea class="textarea" name="description">${escapeHtml(project.description||"")}</textarea></div>
    <div class="form-group"><label>Project code</label><input class="input" name="projectCode" maxlength="30" value="${escapeHtml(project.project_code||"")}" placeholder="OPS-2026-01"></div>
    <div class="form-group"><label>Department</label><input class="input" name="department" maxlength="100" value="${escapeHtml(project.department||"")}" placeholder="Production"></div>
    <div class="form-group" style="grid-column:1/-1"><label>Client / business unit</label><input class="input" name="clientName" maxlength="140" value="${escapeHtml(project.client_name||"")}" placeholder="Internal Operations"></div>
    <div class="form-group"><label>Status</label><select class="select" name="status">${["PLANNING","ACTIVE","ON_HOLD","COMPLETED","ARCHIVED"].map(s=>`<option ${project.status===s?"selected":""}>${s}</option>`).join("")}</select></div>
    <div class="form-group"><label>Priority</label><select class="select" name="priority">${["LOW","MEDIUM","HIGH","CRITICAL"].map(s=>`<option ${project.priority===s?"selected":""}>${s}</option>`).join("")}</select></div>
    <div class="form-group"><label>Start date</label><input class="input" type="date" name="startDate" value="${project.start_date?String(project.start_date).slice(0,10):""}"></div>
    <div class="form-group"><label>Due date</label><input class="input" type="date" name="dueDate" value="${project.due_date?String(project.due_date).slice(0,10):""}"></div>
    <div style="grid-column:1/-1;display:flex;justify-content:space-between;gap:8px">
      ${project.viewer_role==="OWNER"?`<button type="button" class="btn btn-danger" id="deleteProject">Delete project</button>`:"<span></span>"}
      <div class="actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save project</button></div>
    </div>
  </form>`});
  const form=m.querySelector("#projectSettingsForm");
  form.addEventListener("submit",async e=>{
    e.preventDefault();const btn=form.querySelector("[type=submit]");setButtonLoading(btn,true);
    const data=Object.fromEntries(new FormData(form));if(!data.startDate)data.startDate=null;if(!data.dueDate)data.dueDate=null;
    try{await put(`/projects/${projectId}`,data);m.close?.();toast("Project updated.","success");await loadAll();}
    catch(err){toast(err.message,"error");setButtonLoading(btn,false);}
  });
  m.querySelector("#deleteProject")?.addEventListener("click",async()=>{
    if(!confirm(`Delete "${project.name}" and all of its tasks?`))return;
    try{await del(`/projects/${projectId}`);toast("Project deleted.","success");location.href="/projects.html";}catch(err){toast(err.message,"error");}
  });
});

document.querySelector("#addTask")?.addEventListener("click",()=>editTask());
document.querySelector("#starProject")?.addEventListener("click",async()=>{
  try{const data=await patch(`/projects/${projectId}/star`,{isStarred:!project.is_starred});project.is_starred=data.is_starred;await loadAll();toast(project.is_starred?"Project prioritized.":"Project priority removed.","success");}
  catch(err){toast(err.message,"error");}
});

function editTask(task){
  const m=modal({title:task?"Edit task":"Create task",body:taskForm(task)});
  const form=m.querySelector("#taskForm");form.addEventListener("submit",async e=>{
    e.preventDefault();const btn=form.querySelector("[type=submit]");setButtonLoading(btn,true);
    const data=Object.fromEntries(new FormData(form));data.labels=data.labels.split(",").map(x=>x.trim()).filter(Boolean);data.estimatedMinutes=Math.round((Number(data.estimatedHours)||0)*60);delete data.estimatedHours;if(!data.assigneeId)data.assigneeId=null;if(!data.dueDate)data.dueDate=null;
    try{task?await put(`/tasks/${task.id}`,data):await post(`/projects/${projectId}/tasks`,data);m.close?.();toast(task?"Task updated.":"Task created.","success");await loadTasks();}
    catch(err){toast(err.message,"error");setButtonLoading(btn,false);}
  });
}

async function openTask(taskId){
  try{
    const [task,comments,activity]=await Promise.all([get(`/tasks/${taskId}`),get(`/tasks/${taskId}/comments`),get(`/tasks/${taskId}/activity`)]);
    const canEdit=["OWNER","ADMIN"].includes(task.viewer_role)||String(currentUser?.id)===String(task.reporter_id)||String(currentUser?.id)===String(task.assignee_id);
    const canDelete=["OWNER","ADMIN"].includes(task.viewer_role)||String(currentUser?.id)===String(task.reporter_id);
    const checklistPercent=Number(task.checklist_total)?Math.round((Number(task.checklist_done||0)/Number(task.checklist_total))*100):0;
    const m=modal({title:task.title,size:"modal-wide",body:`<div class="task-detail-grid">
      <div><p class="task-description">${escapeHtml(task.description||"No description")}</p>
        <div class="actions"><span class="badge ${String(task.priority).toLowerCase()}">${escapeHtml(task.priority)}</span><span class="badge neutral">${escapeHtml(task.status.replaceAll("_"," "))}</span>${task.project_code?`<span class="badge code-badge">${escapeHtml(task.project_code)}</span>`:""}</div>
        <div class="task-metric-strip">
          <div><small>ESTIMATE</small><strong>${task.estimated_minutes?fmtDuration(task.estimated_minutes):"Not set"}</strong></div>
          <div><small>LOGGED</small><strong>${fmtDuration(task.logged_minutes||0)}</strong></div>
          <div><small>CHECKLIST</small><strong>${task.checklist_done||0}/${task.checklist_total||0} · ${checklistPercent}%</strong></div>
        </div>
        <div class="task-extras" data-task-extras></div>
        <h3 style="margin-top:24px">Comments</h3><div id="commentList">${comments.length?comments.map(commentHtml).join(""):`<div class="empty">No comments yet.</div>`}</div>
        <form id="commentForm" style="display:flex;gap:8px;margin-top:12px"><input class="input" name="body" maxlength="5000" placeholder="Write a comment..." required><button class="btn btn-primary">Send</button></form>
      </div>
      <aside><div class="card panel task-facts"><span class="section-kicker">WORK ORDER</span><strong>Project</strong><p>${escapeHtml(task.project_name||project.name)}</p><strong>Assignee</strong><p>${escapeHtml(task.assignee_name||"Unassigned")}</p><strong>Reporter</strong><p>${escapeHtml(task.reporter_name)}</p><strong>Due date</strong><p>${fmtDate(task.due_date)}</p>
      <div class="actions">${canEdit?`<button class="btn btn-secondary btn-sm" id="editTaskBtn">Edit task</button>`:""}${canDelete?`<button class="btn btn-danger btn-sm" id="deleteTaskBtn">Delete</button>`:""}</div></div>
      <h3 style="margin-top:18px">Activity</h3><div class="timeline">${activity.length?activity.map(a=>`<div class="timeline-item"><span class="timeline-dot"></span><div>${escapeHtml(a.action.replaceAll("_"," ").toLowerCase())}<div class="muted">${timeAgo(a.created_at)}</div></div></div>`).join(""):`<div class="muted">No activity</div>`}</div></aside>
    </div>`});
    bindCommentActions(m,task);
    mountTaskExtras(m,task,loadTasks);
    m.querySelector("#editTaskBtn")?.addEventListener("click",()=>{m.close?.();editTask(task)});
    m.querySelector("#deleteTaskBtn")?.addEventListener("click",async()=>{if(confirm("Delete this task?")){try{await del(`/tasks/${task.id}`);m.close?.();toast("Task deleted.","success");loadTasks();}catch(err){toast(err.message,"error")}}});
    m.querySelector("#commentForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;try{await post(`/tasks/${task.id}/comments`,{body:f.body.value});f.reset();const updated=await get(`/tasks/${task.id}/comments`);m.querySelector("#commentList").innerHTML=updated.map(commentHtml).join("");bindCommentActions(m,task);loadTasks();}catch(err){toast(err.message,"error")}});
  }catch(err){toast(err.message,"error");}
}
function commentHtml(c){const mine=currentUser?.id===c.author_id;return `<div class="comment" data-comment-id="${c.id}"><div class="comment-head"><strong>${escapeHtml(c.author_name)}</strong><span><small class="muted">${timeAgo(c.created_at)}${c.edited_at?" · edited":""}</small>${mine?` <button class="btn btn-ghost btn-sm" data-edit-comment="${c.id}">Edit</button><button class="btn btn-ghost btn-sm" data-delete-comment="${c.id}">Delete</button>`:""}</span></div><div class="comment-body">${escapeHtml(c.body)}</div></div>`;}
function bindCommentActions(m,task){
  m.querySelectorAll("[data-edit-comment]").forEach(btn=>btn.onclick=async()=>{
    const row=btn.closest(".comment");const old=row.querySelector(".comment-body").textContent;
    const body=prompt("Edit your comment:",old);if(body===null||!body.trim())return;
    try{await put(`/comments/${btn.dataset.editComment}`,{body});const updated=await get(`/tasks/${task.id}/comments`);m.querySelector("#commentList").innerHTML=updated.map(commentHtml).join("");bindCommentActions(m,task);}catch(err){toast(err.message,"error");}
  });
  m.querySelectorAll("[data-delete-comment]").forEach(btn=>btn.onclick=async()=>{
    if(!confirm("Delete this comment?"))return;
    try{await del(`/comments/${btn.dataset.deleteComment}`);const updated=await get(`/tasks/${task.id}/comments`);m.querySelector("#commentList").innerHTML=updated.length?updated.map(commentHtml).join(""):`<div class="empty">No comments yet.</div>`;bindCommentActions(m,task);loadTasks();}catch(err){toast(err.message,"error");}
  });
}

on("task:created",loadTasks);on("task:updated",loadTasks);on("task:deleted",loadTasks);on("task:moved",loadTasks);on("task:assigned",loadTasks);on("comment:created",loadTasks);on("comment:updated",loadTasks);on("comment:deleted",loadTasks);on("checklist:updated",loadTasks);on("time:updated",loadTasks);on("project:updated",loadAll);
await loadAll();
