import { get, post, put, del } from "./api.js";
import { boot } from "./app.js";
import { escapeHtml, initials, modal, setButtonLoading, toast } from "./ui.js";

await boot();

const select = document.querySelector("#teamProject");
const list = document.querySelector("#teamList");
const addButton = document.querySelector("#addMember");
let projects = [];
let current = null;

function memberMarkup(member) {
  const canChangeRole = current?.viewer_role === "OWNER" && member.role !== "OWNER";
  const canRemove = ["OWNER", "ADMIN"].includes(current?.viewer_role) && member.role !== "OWNER";
  const title = member.job_title || "Project team member";
  const unit = member.department || member.location || "Cross-functional";
  return `<article class="card member-item">
    <div class="avatar member-avatar" data-member-avatar="${escapeHtml(member.id)}">${initials(member.full_name)}</div>
    <div class="grow member-identity"><strong>${escapeHtml(member.full_name)}</strong><span>@${escapeHtml(member.username)} · ${escapeHtml(title)}</span><small>${escapeHtml(unit)}</small></div>
    <div class="member-load"><strong>${Number(member.assigned_tasks || 0)}</strong><small>OPEN TASKS</small></div>
    <span class="badge role-${String(member.role).toLowerCase()}">${escapeHtml(member.role)}</span>
    ${canChangeRole ? `<select class="select member-role-select" data-role="${member.id}" aria-label="Role for ${escapeHtml(member.full_name)}"><option ${member.role === "MEMBER" ? "selected" : ""}>MEMBER</option><option ${member.role === "ADMIN" ? "selected" : ""}>ADMIN</option></select>` : ""}
    ${canRemove ? `<button type="button" class="btn btn-danger btn-sm" data-remove="${member.id}">Remove</button>` : ""}
  </article>`;
}

async function load() {
  if (!select.value || !projects.length) {
    current = null;
    addButton.classList.add("hidden");
    list.innerHTML = `<div class="empty">Create a project before building a delivery team.</div>`;
    return;
  }
  current = projects.find((project) => String(project.id) === String(select.value));
  addButton.classList.toggle("hidden", !["OWNER", "ADMIN"].includes(current?.viewer_role));
  const summary = document.querySelector("#teamProjectSummary");
  if (summary) summary.innerHTML = `<span class="project-code">${escapeHtml(current?.project_code || "GENERAL")}</span><span>${escapeHtml(current?.department || "Cross-functional")}</span><span>${escapeHtml(current?.client_name || "Internal operation")}</span>`;
  list.innerHTML = `<div class="card skeleton member-skeleton"></div><div class="card skeleton member-skeleton"></div>`;
  try {
    const members = await get(`/projects/${select.value}/members`);
    const count = document.querySelector("#teamCount");
    if (count) count.textContent = `${members.length} authorized member${members.length === 1 ? "" : "s"}`;
    list.innerHTML = members.length ? members.map(memberMarkup).join("") : `<div class="empty">No members found.</div>`;
    list.querySelectorAll("[data-role]").forEach((roleSelect) => {
      roleSelect.addEventListener("change", async () => {
        roleSelect.disabled = true;
        try {
          await put(`/projects/${select.value}/members/${roleSelect.dataset.role}`, { role: roleSelect.value });
          toast("Member authorization updated.", "success");
          await load();
        } catch (error) {
          toast(error.message, "error");
          roleSelect.disabled = false;
        }
      });
    });
    list.querySelectorAll("[data-remove]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Remove this member from the project and unassign their work?")) return;
        try {
          await del(`/projects/${select.value}/members/${button.dataset.remove}`);
          toast("Member access removed.", "success");
          await load();
        } catch (error) { toast(error.message, "error"); }
      });
    });
  } catch (error) {
    list.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

function openAdd() {
  if (!current) return;
  const modalRoot = modal({ title: "Authorize project member", body: `<form id="addMemberForm" class="form-grid">
    <div class="access-note form-span-full"><strong>${escapeHtml(current.name)}</strong><span>Members need an existing ShilpoSetu account before authorization.</span></div>
    <div class="form-group form-span-full"><label>Email or username</label><input class="input" name="identity" autocomplete="off" maxlength="255" required placeholder="operator@example.com"></div>
    <div class="form-group"><label>Access role</label><select class="select" name="role"><option>MEMBER</option><option>ADMIN</option></select></div>
    <div class="modal-form-actions form-span-full"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" type="submit">Authorize member</button></div>
  </form>` });
  const form = modalRoot.querySelector("form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("[type=submit]");
    setButtonLoading(button, true, "Authorizing…");
    try {
      await post(`/projects/${select.value}/members`, Object.fromEntries(new FormData(form)));
      modalRoot.close?.();
      toast("Member authorized for this project.", "success");
      await load();
    } catch (error) {
      toast(error.message, "error");
      setButtonLoading(button, false);
    }
  });
}

try {
  projects = await get("/projects");
  const requested = new URLSearchParams(location.search).get("project");
  select.innerHTML = projects.length
    ? projects.map((project) => `<option value="${project.id}" ${String(project.id) === String(requested) ? "selected" : ""}>${escapeHtml(project.project_code || "GENERAL")} · ${escapeHtml(project.name)}</option>`).join("")
    : `<option value="">No projects available</option>`;
  select.addEventListener("change", () => {
    const url = new URL(location.href);
    if (select.value) url.searchParams.set("project", select.value); else url.searchParams.delete("project");
    history.replaceState(null, "", url);
    load();
  });
  addButton.addEventListener("click", openAdd);
  await load();
} catch (error) {
  list.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  addButton.classList.add("hidden");
}
