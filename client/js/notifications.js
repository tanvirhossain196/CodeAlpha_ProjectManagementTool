import { get, patch } from "./api.js";
import { boot } from "./app.js";
import { escapeHtml, timeAgo, refreshNotificationCount, toast } from "./ui.js";
import { on } from "./socket.js";

await boot();

const list = document.querySelector("#notificationList");
let notifications = [];

function notificationHref(item) {
  if (item.task_id) return `/task.html?id=${encodeURIComponent(item.task_id)}`;
  if (item.project_id) return `/project.html?id=${encodeURIComponent(item.project_id)}`;
  return "";
}

function iconFor(type = "") {
  if (type.includes("DEADLINE")) return "!";
  if (type.includes("COMMENT")) return "◌";
  if (type.includes("MEMBER")) return "◎";
  if (type.includes("TASK")) return "✓";
  return "↗";
}

function render() {
  const unreadOnly = Boolean(document.querySelector("#unreadOnly")?.checked);
  const visible = unreadOnly ? notifications.filter((item) => !item.is_read) : notifications;
  const unread = notifications.filter((item) => !item.is_read).length;
  const label = document.querySelector("#notificationSummary");
  if (label) label.textContent = `${unread} unread · ${notifications.length} total`;
  list.innerHTML = visible.length ? visible.map((item) => {
    const href = notificationHref(item);
    return `<article class="notification-item ${item.is_read ? "" : "unread"}">
      <span class="notification-type-icon">${iconFor(item.type)}</span>
      <div class="grow"><div class="notification-title-line"><strong>${escapeHtml(item.title)}</strong>${item.is_read ? "" : `<span class="unread-marker">NEW</span>`}</div><p>${escapeHtml(item.message)}</p><small>${timeAgo(item.created_at)} · ${escapeHtml(String(item.type || "UPDATE").replaceAll("_", " "))}</small></div>
      <div class="notification-actions">${href ? `<a class="btn btn-ghost btn-sm" href="${href}">Open</a>` : ""}${!item.is_read ? `<button type="button" class="btn btn-secondary btn-sm" data-read="${item.id}">Mark read</button>` : ""}</div>
    </article>`;
  }).join("") : `<div class="empty">${unreadOnly ? "No unread notifications." : "Your operational inbox is clear."}</div>`;
  list.querySelectorAll("[data-read]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await patch(`/notifications/${button.dataset.read}/read`, {});
        const item = notifications.find((row) => String(row.id) === button.dataset.read);
        if (item) item.is_read = true;
        render();
        refreshNotificationCount();
      } catch (error) {
        toast(error.message, "error");
        button.disabled = false;
      }
    });
  });
}

async function load() {
  list.innerHTML = `<div class="table-loading">Synchronizing notification inbox…</div>`;
  try {
    notifications = await get("/notifications");
    render();
  } catch (error) {
    list.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

document.querySelector("#unreadOnly")?.addEventListener("change", render);
document.querySelector("#readAll")?.addEventListener("click", async () => {
  try {
    await patch("/notifications/read-all", {});
    notifications.forEach((item) => { item.is_read = true; });
    render();
    refreshNotificationCount();
    toast("Operational inbox cleared.", "success");
  } catch (error) { toast(error.message, "error"); }
});
document.querySelector("#refreshNotifications")?.addEventListener("click", load);
on("notification:new", load);

await load();
