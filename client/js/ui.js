import { get } from "./api.js";

const NAV_ITEMS = {
  dashboard: ["⌂", "Dashboard"],
  projects: ["▣", "Projects"],
  tasks: ["✓", "My Tasks"],
  team: ["◎", "Team"],
  reports: ["▥", "Reports"],
  notifications: ["◌", "Notifications"],
  profile: ["◉", "Profile"],
  settings: ["⚙", "Settings"],
};

const SHELL_ICONS = {
  collapse: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 7-5 5 5 5"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 8l4 4-4 4M9 12h9"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
};

const THEME_POLICY_KEY = "shilposetu_theme_policy";
const THEME_POLICY_VERSION = "light-default-v1";

export const escapeHtml = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char],
  );

export const fmtDate = (date) =>
  date
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(`${String(date).slice(0, 10)}T00:00:00`))
    : "—";

export const fmtDuration = (minutes = 0) => {
  const value = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  if (!hours) return `${mins}m`;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
};

export const timeAgo = (date) => {
  if (!date) return "";
  const delta = Date.now() - new Date(date).getTime();
  if (!Number.isFinite(delta)) return "";
  const future = delta < 0;
  const seconds = Math.floor(Math.abs(delta) / 1000);
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (seconds >= size) {
      const count = Math.floor(seconds / size);
      return future
        ? `in ${count} ${unit}${count > 1 ? "s" : ""}`
        : `${count} ${unit}${count > 1 ? "s" : ""} ago`;
    }
  }
  return "just now";
};

export function initials(name = "U") {
  return (
    String(name || "U")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || "")
      .join("")
      .toUpperCase() || "U"
  );
}

export function applyPreferences() {
  const root = document.documentElement;
  if (localStorage.getItem(THEME_POLICY_KEY) !== THEME_POLICY_VERSION) {
    localStorage.setItem("shilposetu_theme", "light");
    localStorage.setItem(THEME_POLICY_KEY, THEME_POLICY_VERSION);
  }
  const storedTheme = localStorage.getItem("shilposetu_theme");
  const theme = storedTheme === "dark" ? "dark" : "light";
  // Earlier builds supported "system". Migrate it to the new light-by-default rule.
  if (storedTheme && storedTheme !== "light" && storedTheme !== "dark") {
    localStorage.setItem("shilposetu_theme", "light");
  }
  root.dataset.theme = theme;
  root.dataset.density =
    localStorage.getItem("shilposetu_density") || "comfortable";
  root.dataset.motion = localStorage.getItem("shilposetu_motion") || "full";
  document
    .querySelectorAll("[data-theme-toggle], [data-theme-nav]")
    .forEach((button) => {
      const isDark = theme === "dark";

      button.classList.toggle("active", isDark);
      button.setAttribute("aria-pressed", String(isDark));
      button.setAttribute(
        "aria-label",
        isDark ? "Switch to light mode" : "Switch to dark mode",
      );

      button.title = isDark ? "Switch to light mode" : "Switch to dark mode";

      if (button.hasAttribute("data-theme-nav")) {
        button.innerHTML = isDark ? SHELL_ICONS.sun : SHELL_ICONS.moon;

        return;
      }

      const icon = button.querySelector(".sidebar-action-icon");
      const label = button.querySelector(".theme-toggle-label");

      if (icon) {
        icon.innerHTML = isDark ? SHELL_ICONS.sun : SHELL_ICONS.moon;
      }

      if (label) {
        label.textContent = isDark ? "Light mode" : "Dark mode";
      }
    });
}

export function initThemeControls() {
  const setupTheme = () => {
    prepareTopbarThemeToggle();
    applyPreferences();

    document.querySelectorAll("[data-theme-nav]").forEach((button) => {
      // একই button-এ একাধিক click event বন্ধ করবে
      if (button.dataset.themeReady === "true") return;

      button.dataset.themeReady = "true";

      button.addEventListener("click", () => {
        const currentTheme = document.documentElement.dataset.theme || "light";

        const nextTheme = currentTheme === "dark" ? "light" : "dark";

        localStorage.setItem("shilposetu_theme", nextTheme);

        applyPreferences();
      });
    });
  };

  // HTML সম্পূর্ণ load হওয়ার পরে toggle চালু হবে
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupTheme, {
      once: true,
    });

    return;
  }

  setupTheme();
}

export function toast(message, type = "") {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    stack.setAttribute("aria-live", "polite");
    stack.setAttribute("aria-atomic", "true");
    document.body.append(stack);
  }
  const element = document.createElement("div");
  element.className = `toast ${type}`;
  element.setAttribute("role", type === "error" ? "alert" : "status");
  element.textContent = message;
  stack.append(element);
  setTimeout(() => element.remove(), 3800);
}

export function setButtonLoading(button, loading, text = "Saving...") {
  if (!button) return;
  if (loading) {
    if (!button.dataset.old) button.dataset.old = button.innerHTML;
    button.disabled = true;
    button.textContent = text;
  } else {
    button.disabled = false;
    if (button.dataset.old) {
      button.innerHTML = button.dataset.old;
      delete button.dataset.old;
    }
  }
}

export function modal({ title, body, footer = "", size = "" }) {
  const active = document.activeElement;
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<section class="modal ${escapeHtml(size)}" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
    <header class="modal-header">
      <div><div class="modal-kicker">SHILPOSETU WORKSPACE</div><h2 id="modalTitle">${escapeHtml(title)}</h2></div>
      <button class="icon-btn" type="button" data-close aria-label="Close dialog">✕</button>
    </header>
    <div class="modal-body">${body}</div>
    ${footer ? `<footer class="modal-footer">${footer}</footer>` : ""}
  </section>`;
  const close = () => {
    document.removeEventListener("keydown", onKeydown);
    backdrop.remove();
    document.body.classList.remove("modal-open");
    active?.focus?.();
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") close();
    if (event.key !== "Tab") return;
    const focusable = [
      ...backdrop.querySelectorAll(
        "button,a,input,select,textarea,[tabindex]:not([tabindex='-1'])",
      ),
    ].filter((element) => !element.disabled && element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop || event.target.closest("[data-close]"))
      close();
  });
  document.addEventListener("keydown", onKeydown);
  document.body.append(backdrop);
  document.body.classList.add("modal-open");
  requestAnimationFrame(() =>
    backdrop.querySelector("input,select,textarea,button")?.focus(),
  );
  backdrop.close = close;
  return backdrop;
}

export function currentPage() {
  return document.body.dataset.page || "";
}

function renderAvatar(element, user) {
  if (!element) return;
  const avatar = String(user.avatar_url || "");
  element.textContent = initials(user.full_name);
  element.style.backgroundImage = "";
  element.classList.toggle("has-image", Boolean(avatar));
  if (avatar) {
    element.textContent = "";
    element.style.backgroundImage = `url("${avatar.replace(/["\\]/g, "")}")`;
  }
}

function closeMobileSidebar() {
  document.querySelector(".sidebar")?.classList.remove("open");
  document.querySelector(".sidebar-scrim")?.classList.remove("active");
  const toggle = document.querySelector("[data-sidebar-toggle]");
  toggle?.setAttribute("aria-expanded", "false");
  toggle?.setAttribute("aria-label", "Open workspace navigation");
  document.body.classList.remove("nav-open");
}

function prepareNavigation() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;
  const brandText = sidebar.querySelector(".brand > span:last-child");
  if (brandText) {
    brandText.classList.add("brand-copy");
  }
  const teamLink = sidebar.querySelector('[data-nav="team"]');
  if (teamLink && !sidebar.querySelector('[data-nav="reports"]')) {
    const reports = document.createElement("a");
    reports.className = "nav-link";
    reports.dataset.nav = "reports";
    reports.href = "/reports.html";
    teamLink.after(reports);
  }
  sidebar.querySelectorAll("[data-nav]").forEach((link) => {
    const meta = NAV_ITEMS[link.dataset.nav];
    if (!meta) return;
    link.innerHTML = `<span class="nav-icon" aria-hidden="true">${meta[0]}</span><span class="nav-label">${meta[1]}</span>`;
    link.title = meta[1];
    if (link.dataset.nav === currentPage()) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
    link.addEventListener("click", closeMobileSidebar);
  });
  document.querySelectorAll(".mobile-bottom a").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const page = href.includes("dashboard")
      ? "dashboard"
      : href.includes("projects")
        ? "projects"
        : href.includes("tasks")
          ? "tasks"
          : href.includes("team")
            ? "team"
            : href.includes("profile")
              ? "profile"
              : "";
    if (page === currentPage()) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });

  const profile = sidebar.querySelector(".sidebar-profile");
  if (profile && !sidebar.querySelector(".sidebar-footer")) {
    const footer = document.createElement("div");
    footer.className = "sidebar-footer";
    profile.before(footer);
    footer.append(profile);

    const themeToggle = document.createElement("button");
    themeToggle.type = "button";
    themeToggle.className = "sidebar-action sidebar-theme-toggle";
    themeToggle.dataset.themeToggle = "";
    themeToggle.innerHTML = `<span class="sidebar-action-icon">${SHELL_ICONS.moon}</span><span class="nav-label theme-toggle-label">Dark mode</span><span class="theme-switch" aria-hidden="true"><i></i></span>`;
    footer.append(themeToggle);

    const logoutButton = profile.querySelector("[data-logout]");
    if (logoutButton) {
      logoutButton.remove();
      logoutButton.className = "sidebar-action sidebar-logout";
      logoutButton.title = "Sign out";
      logoutButton.setAttribute("aria-label", "Sign out");
      logoutButton.innerHTML = `<span class="sidebar-action-icon">${SHELL_ICONS.logout}</span><span class="nav-label">Logout</span>`;
      footer.append(logoutButton);
    }

    themeToggle.addEventListener("click", () => {
      const nextTheme =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem("shilposetu_theme", nextTheme);
      applyPreferences();
      toast(
        `${nextTheme === "dark" ? "Dark" : "Light"} mode activated.`,
        "success",
      );
    });
    applyPreferences();
  }
}

function prepareTopbarThemeToggle() {
  const actionContainers = document.querySelectorAll(
    ".landing-header .actions, .top-actions",
  );

  actionContainers.forEach((actions) => {
    // HTML-এ button থাকলে নতুন button বানাবে না
    if (actions.querySelector("[data-theme-nav]")) return;

    const button = document.createElement("button");

    button.type = "button";
    button.dataset.themeNav = "";

    button.className = actions.closest(".landing-header")
      ? "icon-btn nav-theme-toggle landing-theme-toggle"
      : "icon-btn nav-theme-toggle";

    button.setAttribute("aria-label", "Switch to dark mode");
    button.setAttribute("aria-pressed", "false");
    button.title = "Switch to dark mode";

    actions.prepend(button);
  });
}

function initSidebar() {
  const shell = document.querySelector(".app-shell");
  const sidebar = document.querySelector(".sidebar");
  if (!shell || !sidebar) return;
  if (!sidebar.id) sidebar.id = "workspaceNavigation";
  const collapsed = localStorage.getItem("shilposetu_sidebar") === "collapsed";
  shell.classList.toggle("sidebar-collapsed", collapsed && innerWidth > 900);
  let sidebarHeader = sidebar.querySelector(".sidebar-header");
  if (!sidebarHeader) {
    sidebarHeader = document.createElement("div");
    sidebarHeader.className = "sidebar-header";
    const brand = sidebar.querySelector(":scope > .brand");
    if (brand) {
      brand.before(sidebarHeader);
      sidebarHeader.append(brand);
    } else {
      sidebar.prepend(sidebarHeader);
    }
  }
  if (!sidebar.querySelector("[data-sidebar-collapse]")) {
    const collapse = document.createElement("button");
    collapse.type = "button";
    collapse.className = "sidebar-collapse";
    collapse.dataset.sidebarCollapse = "";
    collapse.innerHTML = `<span class="desktop-collapse-icon">${SHELL_ICONS.collapse}</span><span class="mobile-close-icon">${SHELL_ICONS.close}</span>`;
    collapse.setAttribute(
      "aria-label",
      collapsed ? "Expand sidebar" : "Collapse sidebar",
    );
    collapse.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
    sidebarHeader.append(collapse);
    collapse.addEventListener("click", () => {
      if (innerWidth <= 1024) {
        closeMobileSidebar();
        return;
      }
      const next = !shell.classList.contains("sidebar-collapsed");
      shell.classList.toggle("sidebar-collapsed", next);
      localStorage.setItem(
        "shilposetu_sidebar",
        next ? "collapsed" : "expanded",
      );
      collapse.setAttribute(
        "aria-label",
        next ? "Expand sidebar" : "Collapse sidebar",
      );
      collapse.title = next ? "Expand sidebar" : "Collapse sidebar";
    });
  }
  if (!shell.querySelector(".sidebar-scrim")) {
    const scrim = document.createElement("button");
    scrim.type = "button";
    scrim.className = "sidebar-scrim";
    scrim.setAttribute("aria-label", "Close navigation");
    scrim.addEventListener("click", closeMobileSidebar);
    shell.append(scrim);
  }
  const mobileToggle = document.querySelector("[data-sidebar-toggle]");
  mobileToggle?.setAttribute("aria-controls", sidebar.id);
  mobileToggle?.setAttribute("aria-expanded", "false");
  mobileToggle?.setAttribute("aria-label", "Open workspace navigation");
  document
    .querySelector(".mobile-header a[href*='notifications']")
    ?.setAttribute("aria-label", "Open notifications");
  mobileToggle?.addEventListener("click", () => {
    const open = !sidebar.classList.contains("open");
    sidebar.classList.toggle("open", open);
    document.querySelector(".sidebar-scrim")?.classList.toggle("active", open);
    document.body.classList.toggle("nav-open", open);
    mobileToggle.setAttribute("aria-expanded", String(open));
    mobileToggle.setAttribute(
      "aria-label",
      open ? "Close workspace navigation" : "Open workspace navigation",
    );
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMobileSidebar();
  });
}

export async function initShell(user) {
  applyPreferences();
  prepareNavigation();
  initSidebar();

  prepareTopbarThemeToggle();
  initThemeControls();

  document.querySelectorAll("[data-user-name]").forEach((element) => {
    element.textContent = user.full_name;
  });

  document.querySelectorAll("[data-user-role]").forEach((element) => {
    element.textContent =
      user.job_title || user.department || "Workspace member";
  });

  document.querySelectorAll("[data-user-initials]").forEach((element) => {
    renderAvatar(element, user);
  });

  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", () =>
      window.dispatchEvent(new CustomEvent("shilposetu:logout")),
    );
  });

  initSearch();
  refreshNotificationCount();
}

export async function refreshNotificationCount() {
  try {
    const data = await get("/notifications/unread-count");
    const count = Number(data.count || 0);
    document
      .querySelectorAll("[data-notification-count]")
      .forEach((element) => {
        element.textContent = count > 99 ? "99+" : count;
        element.classList.toggle("hidden", !count);
      });
  } catch {}
}

function initSearch() {
  const input = document.querySelector("#globalSearch");
  const box = document.querySelector("#searchResults");
  if (!input || !box || input.dataset.ready) return;
  input.dataset.ready = "1";
  input.setAttribute("aria-expanded", "false");
  let timer;
  let requestId = 0;
  const hide = () => {
    box.classList.add("hidden");
    input.setAttribute("aria-expanded", "false");
  };
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const ownRequest = ++requestId;
    timer = setTimeout(async () => {
      const query = input.value.trim();
      if (query.length < 2) return hide();
      box.innerHTML = `<div class="search-loading">Searching workspace…</div>`;
      box.classList.remove("hidden");
      input.setAttribute("aria-expanded", "true");
      try {
        const data = await get(`/search?q=${encodeURIComponent(query)}`);
        if (ownRequest !== requestId) return;
        const items = [...data.projects, ...data.tasks, ...data.users];
        box.innerHTML = items.length
          ? items
              .map((item) => {
                const href =
                  item.category === "project"
                    ? `/project.html?id=${encodeURIComponent(item.id)}`
                    : item.category === "task"
                      ? `/task.html?id=${encodeURIComponent(item.id)}`
                      : "/team.html";
                const title = item.name || item.title || item.full_name;
                const meta =
                  item.category === "task"
                    ? item.project_name
                    : item.username
                      ? `@${item.username}`
                      : item.status || "";
                return `<a class="search-item" href="${href}">
            <span class="search-item-icon">${NAV_ITEMS[item.category === "task" ? "tasks" : item.category === "project" ? "projects" : "team"][0]}</span>
            <span class="grow"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(meta || "")}</small></span>
            <span class="badge neutral">${escapeHtml(item.category)}</span>
          </a>`;
              })
              .join("")
          : `<div class="empty compact-empty">No matching records.</div>`;
      } catch {
        if (ownRequest === requestId)
          box.innerHTML = `<div class="empty compact-empty">Search is temporarily unavailable.</div>`;
      }
    }, 260);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hide();
      input.blur();
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-wrap")) hide();
  });
  document.addEventListener("keydown", (event) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(
      document.activeElement?.tagName || "",
    );
    if (
      (event.key === "/" && !typing) ||
      ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")
    ) {
      event.preventDefault();
      input.focus();
      input.select();
    }
  });
}

export function projectCard(project, { starControl = false } = {}) {
  const done = Number(project.completed_task_count ?? project.done_count ?? 0);
  const total = Number(project.task_count || 0);
  const percentage = total ? Math.round((done * 100) / total) : 0;
  const overdue =
    project.due_date &&
    new Date(`${String(project.due_date).slice(0, 10)}T23:59:59`) <
      new Date() &&
    !["COMPLETED", "ARCHIVED"].includes(project.status);
  return `<article class="card project-card ${project.is_starred ? "starred" : ""}">
    ${starControl ? `<button type="button" class="project-star-btn ${project.is_starred ? "active" : ""}" data-project-star="${escapeHtml(project.id)}" aria-label="${project.is_starred ? "Remove from priority" : "Add to priority"}" aria-pressed="${Boolean(project.is_starred)}">${project.is_starred ? "★" : "☆"}</button>` : ""}
    <a class="project-card-link" href="/project.html?id=${encodeURIComponent(project.id)}">
      <div class="project-card-top">
        <span class="project-code">${escapeHtml(project.project_code || "GENERAL")}</span>
        ${project.is_starred ? `<span class="star-marker" aria-label="Priority project">★</span>` : ""}
      </div>
      <h3>${escapeHtml(project.name)}</h3>
      <p class="project-description">${escapeHtml((project.description || "No project brief provided.").slice(0, 130))}</p>
      <div class="project-tags">
        <span class="badge status-${String(project.status || "").toLowerCase()}">${escapeHtml(String(project.status || "").replaceAll("_", " "))}</span>
        <span class="badge priority-${String(project.priority || "").toLowerCase()}">${escapeHtml(project.priority || "MEDIUM")}</span>
        ${overdue ? `<span class="badge danger">DELAYED</span>` : ""}
      </div>
      <div class="progress project-progress" role="progressbar" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">
        <span style="width:${Math.min(100, Math.max(0, percentage))}%"></span>
      </div>
      <div class="project-meta"><span>${done}/${total} tasks complete</span><strong>${percentage}%</strong></div>
      ${project.client_name || project.due_date ? `<div class="project-context"><span>${escapeHtml(project.client_name || "Internal operation")}</span><span>${fmtDate(project.due_date)}</span></div>` : ""}
    </a>
  </article>`;
}
