import { get, post, put, patch, del } from "./api.js";
import { boot } from "./app.js";
import { escapeHtml, fmtDate, fmtDuration, initials, modal, setButtonLoading, timeAgo, toast } from "./ui.js";
import { joinProject, on } from "./socket.js";
import { mountTaskExtras } from "./task-extras.js";

const currentUser = await boot();
const id = new URLSearchParams(location.search).get("id");
if (!id) { location.replace("/tasks.html"); await new Promise(() => {}); }
const root = document.querySelector("#taskPage");
let task;
let members = [];
let loading = false;

function canEdit(item) {
  return ["OWNER", "ADMIN"].includes(item.viewer_role)
    || String(currentUser.id) === String(item.reporter_id)
    || String(currentUser.id) === String(item.assignee_id);
}

function canDelete(item) {
  return ["OWNER", "ADMIN"].includes(item.viewer_role) || String(currentUser.id) === String(item.reporter_id);
}

function commentMarkup(comment) {
  const mine = String(currentUser.id) === String(comment.author_id);
  return `<article class="comment" data-comment-id="${comment.id}">
    <div class="comment-avatar avatar avatar-sm">${initials(comment.author_name)}</div>
    <div class="grow"><div class="comment-head"><span><strong>${escapeHtml(comment.author_name)}</strong><small>@${escapeHtml(comment.author_username || "member")}</small></span><span><small>${timeAgo(comment.created_at)}${comment.edited_at ? " · edited" : ""}</small>${mine ? `<button type="button" class="row-action" data-edit-comment="${comment.id}">Edit</button><button type="button" class="row-action danger-text" data-delete-comment="${comment.id}">Delete</button>` : ""}</span></div><div class="comment-body">${escapeHtml(comment.body)}</div></div>
  </article>`;
}

function editTask() {
  const modalRoot = modal({ title: "Update work order", body: `<form id="taskEditForm" class="form-grid">
    <div class="form-group form-span-full"><label>Task title</label><input class="input" name="title" maxlength="200" required value="${escapeHtml(task.title)}"></div>
    <div class="form-group form-span-full"><label>Description</label><textarea class="textarea" name="description" maxlength="10000">${escapeHtml(task.description || "")}</textarea></div>
    <div class="form-group"><label>Status</label><select class="select" name="status">${["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].map((status) => `<option ${task.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></div>
    <div class="form-group"><label>Priority</label><select class="select" name="priority">${["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((priority) => `<option ${task.priority === priority ? "selected" : ""}>${priority}</option>`).join("")}</select></div>
    <div class="form-group"><label>Assignee</label><select class="select" name="assigneeId"><option value="">Unassigned</option>${members.map((member) => `<option value="${member.id}" ${String(task.assignee_id) === String(member.id) ? "selected" : ""}>${escapeHtml(member.full_name)}</option>`).join("")}</select></div>
    <div class="form-group"><label>Due date</label><input class="input" type="date" name="dueDate" value="${task.due_date ? String(task.due_date).slice(0, 10) : ""}"></div>
    <div class="form-group"><label>Estimated hours</label><input class="input" type="number" min="0" max="1666" step="0.25" name="estimatedHours" value="${task.estimated_minutes ? Number(task.estimated_minutes) / 60 : ""}"></div>
    <div class="form-group form-span-full"><label>Labels</label><input class="input" name="labels" value="${escapeHtml((task.labels || []).map((label) => label.name).join(", "))}" placeholder="quality, procurement, safety"></div>
    <div class="modal-form-actions form-span-full"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save work order</button></div>
  </form>` });
  const form = modalRoot.querySelector("form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("[type=submit]");
    setButtonLoading(button, true, "Saving…");
    const data = Object.fromEntries(new FormData(form));
    data.assigneeId = data.assigneeId || null;
    data.dueDate = data.dueDate || null;
    data.estimatedMinutes = Math.round((Number(data.estimatedHours) || 0) * 60);
    data.labels = data.labels.split(",").map((label) => label.trim()).filter(Boolean);
    delete data.estimatedHours;
    try {
      await put(`/tasks/${task.id}`, data);
      modalRoot.close?.();
      toast("Work order updated.", "success");
      await load();
    } catch (error) {
      toast(error.message, "error");
      setButtonLoading(button, false);
    }
  });
}

async function refreshComments() {
  const comments = await get(`/tasks/${id}/comments`);
  const host = root.querySelector("#comments");
  if (!host) return;
  host.innerHTML = comments.length ? comments.map(commentMarkup).join("") : `<div class="empty compact-empty">No comments yet.</div>`;
  bindCommentActions();
}

function bindCommentActions() {
  root.querySelectorAll("[data-edit-comment]").forEach((button) => {
    button.addEventListener("click", async () => {
      const row = button.closest(".comment");
      const previous = row.querySelector(".comment-body").textContent;
      const body = prompt("Edit your comment:", previous);
      if (body === null || !body.trim()) return;
      try { await put(`/comments/${button.dataset.editComment}`, { body }); await refreshComments(); }
      catch (error) { toast(error.message, "error"); }
    });
  });
  root.querySelectorAll("[data-delete-comment]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Delete this comment?")) return;
      try { await del(`/comments/${button.dataset.deleteComment}`); await refreshComments(); }
      catch (error) { toast(error.message, "error"); }
    });
  });
}

async function load() {
  if (loading) return;
  loading = true;
  try {
    const [loadedTask, comments, activity] = await Promise.all([
      get(`/tasks/${id}`), get(`/tasks/${id}/comments`), get(`/tasks/${id}/activity`)
    ]);
    task = loadedTask;
    if (!members.length) members = await get(`/projects/${task.project_id}/members`);
    joinProject(task.project_id);
    const checklistPercent = task.checklist_total ? Math.round((Number(task.checklist_done) / Number(task.checklist_total)) * 100) : 0;
    root.innerHTML = `<div class="page-head task-page-head"><div><div class="eyebrow">${escapeHtml(task.project_code || "GENERAL")} · ${escapeHtml(task.project_name)}</div><h1 class="page-title">${escapeHtml(task.title)}</h1><p class="task-page-description">${escapeHtml(task.description || "No task description has been recorded.")}</p></div>
      <div class="actions"><a class="btn btn-secondary" href="/project.html?id=${encodeURIComponent(task.project_id)}">Open board</a>${canEdit(task) ? `<button type="button" class="btn btn-primary" id="editTask">Edit work order</button>` : ""}${canDelete(task) ? `<button type="button" class="btn btn-danger" id="deleteTask">Delete</button>` : ""}</div></div>
      <div class="task-metric-strip task-page-metrics"><div><small>STATUS</small><strong>${escapeHtml(task.status.replaceAll("_", " "))}</strong></div><div><small>PRIORITY</small><strong>${escapeHtml(task.priority)}</strong></div><div><small>ESTIMATED</small><strong>${task.estimated_minutes ? fmtDuration(task.estimated_minutes) : "Not set"}</strong></div><div><small>LOGGED</small><strong>${fmtDuration(task.logged_minutes || 0)}</strong></div><div><small>CHECKLIST</small><strong>${task.checklist_done || 0}/${task.checklist_total || 0} · ${checklistPercent}%</strong></div></div>
      <div class="task-page-layout"><main class="task-page-main">
        <div class="task-extras task-page-extras" data-task-extras></div>
        <section class="card panel comment-panel"><div class="panel-head"><div><span class="section-kicker">COLLABORATION LOG</span><h2 class="panel-title">Comments</h2></div><span class="badge neutral">${comments.length}</span></div><div id="comments">${comments.length ? comments.map(commentMarkup).join("") : `<div class="empty compact-empty">No comments yet.</div>`}</div>
          <form id="commentForm" class="comment-entry"><input class="input" name="body" maxlength="5000" required placeholder="Add an operational note or decision…"><button class="btn btn-primary" type="submit">Post update</button></form>
        </section>
      </main><aside class="task-page-aside"><section class="card panel task-facts"><span class="section-kicker">CONTROL DATA</span><h2 class="panel-title">Work order facts</h2>
        <dl class="fact-list"><div><dt>Assignee</dt><dd>${escapeHtml(task.assignee_name || "Unassigned")}</dd></div><div><dt>Reporter</dt><dd>${escapeHtml(task.reporter_name)}</dd></div><div><dt>Due date</dt><dd>${fmtDate(task.due_date)}</dd></div><div><dt>Access role</dt><dd>${escapeHtml(task.viewer_role)}</dd></div></dl>
        ${canEdit(task) ? `<div class="form-group quick-status"><label>Quick status control</label><select id="quickStatus" class="select">${["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].map((status) => `<option ${task.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></div>` : ""}
      </section><section class="card panel"><div class="panel-head"><div><span class="section-kicker">AUDIT TRAIL</span><h2 class="panel-title">Activity</h2></div></div><div class="timeline">${activity.length ? activity.map((item) => `<div class="timeline-item"><span class="timeline-dot"></span><div>${escapeHtml(item.action.replaceAll("_", " ").toLowerCase())}<div class="muted">${escapeHtml(item.actor_name || "System")} · ${timeAgo(item.created_at)}</div></div></div>`).join("") : `<div class="muted">No activity recorded.</div>`}</div></section></aside></div>`;

    bindCommentActions();
    mountTaskExtras(root, task, async () => {
      const refreshed = await get(`/tasks/${id}`);
      task = refreshed;
    });
    root.querySelector("#editTask")?.addEventListener("click", editTask);
    root.querySelector("#deleteTask")?.addEventListener("click", async () => {
      if (!confirm("Delete this work order and its full activity record?")) return;
      try { await del(`/tasks/${id}`); toast("Work order deleted.", "success"); location.href = "/tasks.html"; }
      catch (error) { toast(error.message, "error"); }
    });
    root.querySelector("#quickStatus")?.addEventListener("change", async (event) => {
      const select = event.currentTarget;
      select.disabled = true;
      try { await patch(`/tasks/${id}/status`, { status: select.value }); toast("Task stage updated.", "success"); await load(); }
      catch (error) { toast(error.message, "error"); select.disabled = false; }
    });
    root.querySelector("#commentForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector("button");
      setButtonLoading(button, true, "Posting…");
      try { await post(`/tasks/${id}/comments`, { body: form.body.value }); form.reset(); await refreshComments(); toast("Update posted.", "success"); }
      catch (error) { toast(error.message, "error"); }
      finally { setButtonLoading(button, false); }
    });
  } catch (error) {
    root.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  } finally {
    loading = false;
  }
}

["task:updated", "task:moved", "comment:created", "comment:updated", "comment:deleted", "checklist:updated", "time:updated"].forEach((event) => on(event, load));
await load();
