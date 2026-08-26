import { get, post, patch } from "./api.js";
import { boot } from "./app.js";
import { escapeHtml, modal, projectCard, setButtonLoading, toast } from "./ui.js";

await boot();

const grid = document.querySelector("#projectGrid");
let projects = [];
let searchTimer;

function currentFilters() {
  return {
    query: document.querySelector("#projectSearch")?.value.trim().toLowerCase() || "",
    status: document.querySelector("#projectStatus")?.value || "",
    priority: document.querySelector("#projectPriority")?.value || "",
    starred: Boolean(document.querySelector("#starredOnly")?.checked)
  };
}

function render() {
  const filters = currentFilters();
  const visible = projects.filter((project) => {
    const haystack = [project.name, project.description, project.project_code, project.department, project.client_name]
      .join(" ").toLowerCase();
    return (!filters.query || haystack.includes(filters.query))
      && (!filters.status || project.status === filters.status)
      && (!filters.priority || project.priority === filters.priority)
      && (!filters.starred || project.is_starred);
  });
  const counter = document.querySelector("#projectCount");
  if (counter) counter.textContent = `${visible.length} of ${projects.length} projects`;
  grid.innerHTML = visible.length
    ? visible.map((project) => projectCard(project, { starControl: true })).join("")
    : `<div class="empty empty-wide">No projects match the current operational filters.</div>`;
  grid.querySelectorAll("[data-project-star]").forEach((button) => {
    button.addEventListener("click", async () => {
      const project = projects.find((item) => String(item.id) === button.dataset.projectStar);
      if (!project) return;
      button.disabled = true;
      try {
        const data = await patch(`/projects/${project.id}/star`, { isStarred: !project.is_starred });
        project.is_starred = data.is_starred;
        projects.sort((a, b) => Number(b.is_starred) - Number(a.is_starred));
        render();
        toast(project.is_starred ? "Project added to priority watch." : "Project removed from priority watch.", "success");
      } catch (error) {
        toast(error.message, "error");
        button.disabled = false;
      }
    });
  });
}

async function load() {
  grid.innerHTML = `<div class="card skeleton project-skeleton"></div><div class="card skeleton project-skeleton"></div>`;
  try {
    projects = await get("/projects");
    render();
  } catch (error) {
    grid.innerHTML = `<div class="empty empty-wide">${escapeHtml(error.message)}</div>`;
  }
}

document.querySelector("#projectSearch")?.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(render, 180);
});
["projectStatus", "projectPriority", "starredOnly"].forEach((id) => {
  document.querySelector(`#${id}`)?.addEventListener("change", render);
});
document.querySelector("#clearProjectFilters")?.addEventListener("click", () => {
  ["projectSearch", "projectStatus", "projectPriority"].forEach((id) => {
    const input = document.querySelector(`#${id}`);
    if (input) input.value = "";
  });
  const starred = document.querySelector("#starredOnly");
  if (starred) starred.checked = false;
  render();
});

document.querySelector("#createProject")?.addEventListener("click", () => {
  const modalRoot = modal({ title: "Create industrial project", body: `<form id="projectForm" class="form-grid">
    <div class="form-group form-span-full"><label>Project name</label><input class="input" name="name" required maxlength="160" placeholder="Chattogram Plant Expansion"></div>
    <div class="form-group form-span-full"><label>Project brief</label><textarea class="textarea" name="description" maxlength="5000" placeholder="Scope, operational objective and delivery conditions"></textarea></div>
    <div class="form-group"><label>Project code</label><input class="input" name="projectCode" maxlength="30" placeholder="CTG-PLANT-26"></div>
    <div class="form-group"><label>Department</label><input class="input" name="department" maxlength="100" placeholder="Engineering"></div>
    <div class="form-group form-span-full"><label>Client / business unit</label><input class="input" name="clientName" maxlength="140" placeholder="Bangladesh Operations"></div>
    <div class="form-group"><label>Status</label><select class="select" name="status"><option>PLANNING</option><option>ACTIVE</option><option>ON_HOLD</option></select></div>
    <div class="form-group"><label>Priority</label><select class="select" name="priority"><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option><option>LOW</option></select></div>
    <div class="form-group"><label>Start date</label><input class="input" type="date" name="startDate"></div>
    <div class="form-group"><label>Target date</label><input class="input" type="date" name="dueDate"></div>
    <div class="modal-form-actions form-span-full"><button type="button" class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" type="submit">Create project</button></div>
  </form>` });
  const form = modalRoot.querySelector("#projectForm");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("[type=submit]");
    setButtonLoading(button, true, "Creating…");
    try {
      const data = Object.fromEntries(new FormData(form));
      if (!data.startDate) data.startDate = null;
      if (!data.dueDate) data.dueDate = null;
      const project = await post("/projects", data);
      toast("Project command centre created.", "success");
      location.href = `/project.html?id=${encodeURIComponent(project.id)}`;
    } catch (error) {
      toast(error.message, "error");
      setButtonLoading(button, false);
    }
  });
});

await load();
