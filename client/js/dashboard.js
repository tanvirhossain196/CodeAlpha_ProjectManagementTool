import { get } from "./api.js";
import { boot } from "./app.js";
import { escapeHtml, fmtDate, fmtDuration, projectCard, timeAgo } from "./ui.js";

await boot();
const root = document.querySelector("#dashboardRoot");

function metric(label, value, icon, meta, tone = "") {
  return `<article class="card metric ${tone}"><div class="metric-head"><span class="metric-label">${label}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-meta">${meta}</div></article>`;
}

try {
  const data = await get("/dashboard");
  const stats = data.stats;
  document.querySelector("#metrics").innerHTML = [
    metric("ACTIVE PROJECTS", stats.active_projects, "▣", `${stats.total_projects} in portfolio`, "tone-teal"),
    metric("OPEN ASSIGNMENTS", stats.my_tasks, "✓", `${stats.completed_tasks} completed`, "tone-blue"),
    metric("OVERDUE ITEMS", stats.overdue_tasks, "!", stats.overdue_tasks ? "Escalation required" : "Schedule under control", stats.overdue_tasks ? "tone-red" : "tone-green"),
    metric("COMPLETION", `${stats.completion_percentage}%`, "↗", "Personal assignment rate", "tone-amber"),
    metric("TEAM NETWORK", stats.team_members, "◎", "Unique collaborators", "tone-violet"),
    metric("TOTAL PROJECTS", stats.total_projects, "⌗", "Accessible workspaces", "tone-slate")
  ].join("");

  document.querySelector("#recentProjects").innerHTML = data.recentProjects.length
    ? data.recentProjects.map((project) => projectCard(project)).join("")
    : `<div class="empty empty-wide">No projects yet. Establish your first command centre.</div>`;

  document.querySelector("#deadlines").innerHTML = data.upcomingDeadlines.length
    ? data.upcomingDeadlines.map((task) => `<a class="list-row deadline-row" href="/task.html?id=${encodeURIComponent(task.id)}">
        <span class="date-block"><strong>${task.due_date ? String(task.due_date).slice(8, 10) : "—"}</strong><small>${task.due_date ? new Date(`${String(task.due_date).slice(0, 10)}T00:00:00`).toLocaleString(undefined, { month: "short" }).toUpperCase() : "DATE"}</small></span>
        <span class="grow"><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.project_name)}</small></span>
        <span class="badge priority-${String(task.priority).toLowerCase()}">${escapeHtml(task.priority)}</span>
      </a>`).join("")
    : `<div class="empty compact-empty">No scheduled deadlines.</div>`;

  document.querySelector("#focusTasks").innerHTML = data.focusTasks.length
    ? data.focusTasks.map((task, index) => `<a class="focus-task" href="/task.html?id=${encodeURIComponent(task.id)}">
        <span class="focus-rank">${String(index + 1).padStart(2, "0")}</span>
        <span class="grow"><span class="focus-code">${escapeHtml(task.project_code || "GENERAL")} · ${escapeHtml(task.project_name)}</span><strong>${escapeHtml(task.title)}</strong><small>${fmtDate(task.due_date)} · ${fmtDuration(task.estimated_minutes || 0)} estimated</small></span>
        <span class="badge priority-${String(task.priority).toLowerCase()}">${escapeHtml(task.priority)}</span>
      </a>`).join("")
    : `<div class="empty compact-empty">Your execution queue is clear.</div>`;

  const capacity = data.personalCapacity;
  const loadScore = Math.min(100, Math.round((Number(capacity.remaining_estimate || 0) / (40 * 60)) * 100));
  document.querySelector("#capacityPanel").innerHTML = `<div class="capacity-gauge" style="--capacity:${loadScore * 3.6}deg"><div><strong>${loadScore}%</strong><span>planned load</span></div></div>
    <div class="capacity-stats"><div><small>OPEN TASKS</small><strong>${capacity.open_tasks}</strong></div><div><small>REMAINING</small><strong>${fmtDuration(capacity.remaining_estimate)}</strong></div><div><small>LOGGED · 7D</small><strong>${fmtDuration(capacity.logged_this_week)}</strong></div></div>`;

  document.querySelector("#activity").innerHTML = data.recentActivity.length
    ? data.recentActivity.map((item) => `<div class="list-row activity-row"><span class="activity-icon">↗</span><div class="grow"><strong>${escapeHtml(item.actor_name || "System")}</strong> ${escapeHtml(item.action.replaceAll("_", " ").toLowerCase())}<div class="muted">${escapeHtml(item.project_name)} · ${timeAgo(item.created_at)}</div></div></div>`).join("")
    : `<div class="empty compact-empty">No activity recorded yet.</div>`;

  const statuses = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
  const statusData = new Map(data.taskDistribution.map((item) => [item.status, Number(item.count)]));
  const colors = { BACKLOG: "#8a99ab", TODO: "#2f6fed", IN_PROGRESS: "#00a3a3", IN_REVIEW: "#f59e0b", DONE: "#16a56a" };
  const total = statuses.reduce((sum, status) => sum + (statusData.get(status) || 0), 0);
  let offset = 0;
  const segments = statuses.map((status) => {
    const start = total ? (offset / total) * 360 : 0;
    offset += statusData.get(status) || 0;
    const end = total ? (offset / total) * 360 : 0;
    return `${colors[status]} ${start}deg ${end}deg`;
  }).join(",");
  document.querySelector("#distribution").innerHTML = `<div class="distribution-layout"><div class="donut" style="background:conic-gradient(${total ? segments : "#dce3ea 0deg 360deg"})"><div><strong>${total}</strong><span>total tasks</span></div></div><div class="chart-legend">${statuses.map((status) => `<div><span class="legend-dot" style="background:${colors[status]}"></span><span class="grow">${escapeHtml(status.replaceAll("_", " "))}</span><strong>${statusData.get(status) || 0}</strong></div>`).join("")}</div></div>`;
} catch (error) {
  root.innerHTML = `<div class="empty">Unable to load the command centre: ${escapeHtml(error.message)}</div>`;
}
