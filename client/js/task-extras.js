import { get, post, patch, del } from "./api.js";
import { getStoredUser } from "./auth.js";
import { escapeHtml, fmtDate, fmtDuration, setButtonLoading, toast } from "./ui.js";

function checklistMarkup(items) {
  const complete = items.filter((item) => item.is_completed).length;
  const percentage = items.length ? Math.round((complete / items.length) * 100) : 0;
  return `<div class="task-extra-head">
      <div><span class="section-kicker">QUALITY GATE</span><h3>Execution checklist</h3></div>
      <strong>${complete}/${items.length}</strong>
    </div>
    <div class="progress checklist-progress"><span style="width:${percentage}%"></span></div>
    <div class="checklist-list">
      ${items.length ? items.map((item) => `<label class="checklist-item ${item.is_completed ? "completed" : ""}">
        <input type="checkbox" data-check-toggle="${item.id}" ${item.is_completed ? "checked" : ""}>
        <span class="grow">${escapeHtml(item.content)}</span>
        <button type="button" class="row-action danger-text" data-check-delete="${item.id}" aria-label="Delete checklist item">×</button>
      </label>`).join("") : `<div class="empty compact-empty">No checklist items yet.</div>`}
    </div>
    <form class="inline-entry-form" data-check-form>
      <input class="input" name="content" maxlength="240" required placeholder="Add inspection or delivery step">
      <button class="btn btn-secondary" type="submit">Add step</button>
    </form>`;
}

function timeMarkup(entries, task, currentUser) {
  const total = entries.reduce((sum, entry) => sum + Number(entry.minutes || 0), 0);
  const estimated = Number(task.estimated_minutes || 0);
  const percentage = estimated ? Math.min(100, Math.round((total / estimated) * 100)) : 0;
  const canManage = ["OWNER", "ADMIN"].includes(task.viewer_role);
  return `<div class="task-extra-head">
      <div><span class="section-kicker">LABOUR CONTROL</span><h3>Time & effort log</h3></div>
      <strong>${fmtDuration(total)} / ${estimated ? fmtDuration(estimated) : "not estimated"}</strong>
    </div>
    <div class="progress time-progress"><span style="width:${percentage}%"></span></div>
    <form class="time-entry-form" data-time-form>
      <div class="form-group"><label>Minutes</label><input class="input" type="number" name="minutes" min="1" max="1440" required placeholder="60"></div>
      <div class="form-group"><label>Work date</label><input class="input" type="date" name="workDate" value="${new Date().toISOString().slice(0, 10)}" required></div>
      <div class="form-group time-note"><label>Work note</label><input class="input" name="note" maxlength="500" placeholder="Inspection, fabrication, review…"></div>
      <button class="btn btn-secondary" type="submit">Log work</button>
    </form>
    <div class="time-entry-list">
      ${entries.length ? entries.slice(0, 8).map((entry) => `<div class="time-entry">
        <div class="avatar avatar-sm">${escapeHtml((entry.user_name || "U").slice(0, 1).toUpperCase())}</div>
        <div class="grow"><strong>${escapeHtml(entry.user_name || "Team member")}</strong><span>${escapeHtml(entry.note || "Operational work")}</span></div>
        <div class="time-value"><strong>${fmtDuration(entry.minutes)}</strong><small>${fmtDate(entry.work_date)}</small></div>
        ${(entry.user_id === currentUser?.id || canManage) ? `<button type="button" class="row-action danger-text" data-time-delete="${entry.id}" aria-label="Delete time entry">×</button>` : ""}
      </div>`).join("") : `<div class="empty compact-empty">No work time has been logged.</div>`}
    </div>`;
}

export async function mountTaskExtras(container, task, onChange = () => {}) {
  const host = container.querySelector("[data-task-extras]");
  if (!host) return;
  host.innerHTML = `<div class="task-extra-card skeleton task-extra-skeleton"></div><div class="task-extra-card skeleton task-extra-skeleton"></div>`;
  try {
    const [items, entries] = await Promise.all([
      get(`/tasks/${task.id}/checklist`),
      get(`/tasks/${task.id}/time`)
    ]);
    const currentUser = getStoredUser();
    host.innerHTML = `<section class="task-extra-card" data-checklist-panel>${checklistMarkup(items)}</section>
      <section class="task-extra-card" data-time-panel>${timeMarkup(entries, task, currentUser)}</section>`;

    host.querySelector("[data-check-form]").onsubmit = async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector("button");
      setButtonLoading(button, true, "Adding…");
      try {
        await post(`/tasks/${task.id}/checklist`, { content: event.currentTarget.content.value });
        toast("Checklist step added.", "success");
        await mountTaskExtras(container, task, onChange);
        onChange();
      } catch (error) {
        toast(error.message, "error");
        setButtonLoading(button, false);
      }
    };
    host.querySelectorAll("[data-check-toggle]").forEach((input) => {
      input.onchange = async () => {
        try {
          await patch(`/checklist/${input.dataset.checkToggle}`, { isCompleted: input.checked });
          await mountTaskExtras(container, task, onChange);
          onChange();
        } catch (error) {
          input.checked = !input.checked;
          toast(error.message, "error");
        }
      };
    });
    host.querySelectorAll("[data-check-delete]").forEach((button) => {
      button.onclick = async () => {
        try {
          await del(`/checklist/${button.dataset.checkDelete}`);
          await mountTaskExtras(container, task, onChange);
          onChange();
        } catch (error) { toast(error.message, "error"); }
      };
    });
    host.querySelector("[data-time-form]").onsubmit = async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector("button");
      setButtonLoading(button, true, "Logging…");
      const data = Object.fromEntries(new FormData(event.currentTarget));
      data.minutes = Number(data.minutes);
      try {
        await post(`/tasks/${task.id}/time`, data);
        toast("Work time logged.", "success");
        await mountTaskExtras(container, task, onChange);
        onChange();
      } catch (error) {
        toast(error.message, "error");
        setButtonLoading(button, false);
      }
    };
    host.querySelectorAll("[data-time-delete]").forEach((button) => {
      button.onclick = async () => {
        try {
          await del(`/time/${button.dataset.timeDelete}`);
          await mountTaskExtras(container, task, onChange);
          onChange();
        } catch (error) { toast(error.message, "error"); }
      };
    });
  } catch (error) {
    host.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}
