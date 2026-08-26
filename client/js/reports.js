import { get } from "./api.js";
import { boot } from "./app.js";
import { escapeHtml, fmtDate, fmtDuration, initials, toast } from "./ui.js";

await boot();

const root = document.querySelector("#reportsRoot");
let report;

function healthState(project) {
  if (Number(project.overdue_count) > 0) return ["AT RISK", "danger"];
  if (project.due_date && new Date(`${String(project.due_date).slice(0, 10)}T23:59:59`) < new Date()
    && !["COMPLETED", "ARCHIVED"].includes(project.status)) return ["DELAYED", "danger"];
  if (project.status === "ON_HOLD") return ["ON HOLD", "warning"];
  return ["CONTROLLED", "success"];
}

function mixChart(items, key, colors) {
  const max = Math.max(1, ...items.map((item) => Number(item.count)));
  return `<div class="horizontal-chart">${items.map((item) => {
    const label = item[key];
    return `<div class="horizontal-bar"><span>${escapeHtml(String(label).replaceAll("_", " "))}</span><div class="bar-track"><i style="width:${Math.round((Number(item.count) / max) * 100)}%;background:${colors[label] || "#60758a"}"></i></div><strong>${item.count}</strong></div>`;
  }).join("") || `<div class="empty compact-empty">No report data.</div>`}</div>`;
}

function render(data) {
  const summary = data.summary;
  document.querySelector("#reportMetrics").innerHTML = [
    ["PORTFOLIO", summary.total_projects, `${summary.active_projects} active`],
    ["DELIVERY RATE", `${summary.completion_percentage}%`, `${summary.completed_tasks}/${summary.total_tasks} tasks`],
    ["OVERDUE", summary.overdue_tasks, `${summary.delayed_projects} delayed projects`],
    ["CRITICAL OPEN", summary.critical_open, "Escalation queue"],
    ["ESTIMATED", fmtDuration(summary.estimated_minutes), "Planned task effort"],
    ["LOGGED", fmtDuration(summary.logged_minutes), "Recorded team effort"]
  ].map(([label, value, meta]) => `<article class="card metric"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-meta">${meta}</div></article>`).join("");

  document.querySelector("#projectHealth").innerHTML = data.projectHealth.length ? data.projectHealth.map((project) => {
    const completed = Number(project.completed_count || 0);
    const total = Number(project.task_count || 0);
    const percentage = total ? Math.round((completed / total) * 100) : 0;
    const [health, tone] = healthState(project);
    return `<article class="report-project-row">
      <div class="report-project-name"><span class="project-code">${escapeHtml(project.project_code || "GENERAL")}</span><a href="/project.html?id=${encodeURIComponent(project.id)}"><strong>${escapeHtml(project.name)}</strong></a><small>${escapeHtml(project.status.replaceAll("_", " "))} · due ${fmtDate(project.due_date)}</small></div>
      <div class="report-progress"><div class="progress"><span style="width:${percentage}%"></span></div><small>${completed}/${total} complete · ${percentage}%</small></div>
      <div class="report-hours"><strong>${fmtDuration(project.logged_minutes)}</strong><small>of ${fmtDuration(project.estimated_minutes)} planned</small></div>
      <span class="badge ${tone}">${health}</span>
    </article>`;
  }).join("") : `<div class="empty compact-empty">No projects are available for reporting.</div>`;

  document.querySelector("#workloadGrid").innerHTML = data.workload.length ? data.workload.map((person) => {
    const load = Math.min(100, Math.round((Number(person.remaining_estimate || 0) / (40 * 60)) * 100));
    return `<article class="card workload-card">
      <div class="workload-head"><span class="avatar">${initials(person.full_name)}</span><div class="grow"><strong>${escapeHtml(person.full_name)}</strong><small>${escapeHtml(person.job_title || person.department || "Team member")}</small></div><span class="badge ${person.overdue_tasks ? "danger" : "success"}">${person.overdue_tasks ? `${person.overdue_tasks} overdue` : "On track"}</span></div>
      <div class="workload-numbers"><div><strong>${person.open_tasks}</strong><small>OPEN</small></div><div><strong>${person.critical_tasks}</strong><small>CRITICAL</small></div><div><strong>${fmtDuration(person.logged_this_month)}</strong><small>LOGGED</small></div></div>
      <div class="progress workload-progress"><span style="width:${load}%"></span></div><small>${fmtDuration(person.remaining_estimate)} planned workload · ${load}% of 40h reference</small>
    </article>`;
  }).join("") : `<div class="empty empty-wide">No team workload data.</div>`;

  document.querySelector("#statusMix").innerHTML = mixChart(data.statusMix, "status", { BACKLOG: "#8a99ab", TODO: "#2f6fed", IN_PROGRESS: "#00a3a3", IN_REVIEW: "#f59e0b", DONE: "#16a56a" });
  document.querySelector("#priorityMix").innerHTML = mixChart(data.priorityMix, "priority", { LOW: "#16a56a", MEDIUM: "#2f6fed", HIGH: "#f59e0b", CRITICAL: "#df3c4f" });
  document.querySelector("#reportGenerated").textContent = `Generated ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`;
}

function csvCell(value) {
  let text = String(value ?? "").replaceAll('"', '""');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text}"`;
}

document.querySelector("#exportReport")?.addEventListener("click", () => {
  if (!report) return;
  const rows = [["Project", "Code", "Status", "Priority", "Due", "Tasks", "Completed", "Overdue", "Estimated Minutes", "Logged Minutes"],
    ...report.projectHealth.map((project) => [project.name, project.project_code, project.status, project.priority,
      project.due_date ? String(project.due_date).slice(0, 10) : "", project.task_count, project.completed_count,
      project.overdue_count, project.estimated_minutes, project.logged_minutes])];
  const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = `shilposetu-operational-report-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
  URL.revokeObjectURL(url); toast("Operational report exported.", "success");
});
document.querySelector("#printReport")?.addEventListener("click", () => window.print());

try {
  report = await get("/reports");
  render(report);
} catch (error) {
  root.innerHTML = `<div class="empty">Unable to compile operational report: ${escapeHtml(error.message)}</div>`;
}
