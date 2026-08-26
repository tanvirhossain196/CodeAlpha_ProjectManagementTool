import { get } from "./api.js";
import { boot } from "./app.js";
import { escapeHtml, fmtDate, fmtDuration, toast } from "./ui.js";

await boot();

const body = document.querySelector("#taskRows");
let currentTasks = [];
let searchTimer;

function queryString() {
  const params = new URLSearchParams();
  const mapping = {
    myStatus: "status",
    myPriority: "priority",
    myDue: "due",
    mySort: "sort",
    myTaskSearch: "q"
  };
  for (const [id, key] of Object.entries(mapping)) {
    const value = document.querySelector(`#${id}`)?.value.trim() || "";
    if (value) params.set(key, value);
  }
  return params.toString();
}

function renderOverview(tasks) {
  const overview = document.querySelector("#taskOverview");
  if (!overview) return;
  const open = tasks.filter((task) => task.status !== "DONE").length;
  const overdue = tasks.filter((task) => task.status !== "DONE" && task.due_date
    && new Date(`${String(task.due_date).slice(0, 10)}T23:59:59`) < new Date()).length;
  const critical = tasks.filter((task) => task.status !== "DONE" && task.priority === "CRITICAL").length;
  const logged = tasks.reduce((sum, task) => sum + Number(task.logged_minutes || 0), 0);
  overview.innerHTML = [
    ["OPEN WORK", open, "Execution queue"],
    ["OVERDUE", overdue, overdue ? "Needs escalation" : "Schedule healthy"],
    ["CRITICAL", critical, critical ? "Immediate attention" : "No critical work"],
    ["TIME LOGGED", fmtDuration(logged), "Visible task set"]
  ].map(([label, value, meta]) => `<article class="card metric compact-metric"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-meta">${meta}</div></article>`).join("");
}

function render(tasks) {
  renderOverview(tasks);
  const count = document.querySelector("#taskResultCount");
  if (count) count.textContent = `${tasks.length} assigned task${tasks.length === 1 ? "" : "s"}`;
  body.innerHTML = tasks.length ? tasks.map((task) => {
    const checklist = `${task.checklist_done || 0}/${task.checklist_total || 0}`;
    return `<tr>
      <td data-label="Task"><a class="task-title-link" href="/task.html?id=${encodeURIComponent(task.id)}">${escapeHtml(task.title)}</a><div class="task-row-context"><span class="project-code">${escapeHtml(task.project_code || "GENERAL")}</span><span>${escapeHtml(task.project_name)}</span></div></td>
      <td data-label="Status"><span class="badge status-${String(task.status).toLowerCase()}">${escapeHtml(task.status.replaceAll("_", " "))}</span></td>
      <td data-label="Priority"><span class="badge priority-${String(task.priority).toLowerCase()}">${escapeHtml(task.priority)}</span></td>
      <td data-label="Due"><span class="${task.due_date && task.status !== "DONE" && new Date(`${String(task.due_date).slice(0, 10)}T23:59:59`) < new Date() ? "danger-text" : ""}">${fmtDate(task.due_date)}</span></td>
      <td data-label="Checklist"><span class="work-cell"><strong>${checklist}</strong><small>${fmtDuration(task.logged_minutes || 0)} logged</small></span></td>
      <td data-label="Reporter">${escapeHtml(task.reporter_name)}</td>
      <td data-label="Activity"><span class="comment-count">${task.comment_count || 0} comments</span></td>
    </tr>`;
  }).join("") : `<tr><td colspan="7"><div class="empty">No tasks match these operational filters.</div></td></tr>`;
}

async function load() {
  body.innerHTML = `<tr><td colspan="7"><div class="table-loading">Loading assigned work…</div></td></tr>`;
  try {
    currentTasks = await get(`/tasks?${queryString()}`);
    render(currentTasks);
  } catch (error) {
    body.innerHTML = `<tr><td colspan="7"><div class="empty">${escapeHtml(error.message)}</div></td></tr>`;
  }
}

["myStatus", "myPriority", "myDue", "mySort"].forEach((id) => {
  document.querySelector(`#${id}`)?.addEventListener("change", load);
});
document.querySelector("#myTaskSearch")?.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(load, 260);
});
document.querySelector("#clearTaskFilters")?.addEventListener("click", () => {
  ["myStatus", "myPriority", "myDue", "mySort", "myTaskSearch"].forEach((id) => {
    const input = document.querySelector(`#${id}`);
    if (input) input.value = "";
  });
  load();
});

function csvCell(value) {
  let text = String(value ?? "").replaceAll('"', '""');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text}"`;
}

document.querySelector("#exportTasks")?.addEventListener("click", () => {
  if (!currentTasks.length) return toast("There are no tasks to export.", "error");
  const header = ["Task", "Project", "Project Code", "Status", "Priority", "Due Date", "Reporter", "Checklist", "Logged Minutes"];
  const rows = currentTasks.map((task) => [task.title, task.project_name, task.project_code, task.status, task.priority,
    task.due_date ? String(task.due_date).slice(0, 10) : "", task.reporter_name,
    `${task.checklist_done || 0}/${task.checklist_total || 0}`, task.logged_minutes || 0]);
  const blob = new Blob(["\uFEFF" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `shilposetu-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast("Task register exported.", "success");
});

await load();
