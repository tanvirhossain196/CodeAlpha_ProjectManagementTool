import { boot } from "./app.js";
import { applyPreferences, toast } from "./ui.js";

await boot();

const defaults = { theme: "light", density: "comfortable", motion: "full" };
const keys = {
  theme: "shilposetu_theme",
  density: "shilposetu_density",
  motion: "shilposetu_motion"
};

function valueFor(group) {
  const value = localStorage.getItem(keys[group]) || defaults[group];
  if (group === "theme" && value !== "light" && value !== "dark") return "light";
  return value;
}

function render() {
  for (const group of Object.keys(keys)) {
    const value = valueFor(group);
    document.querySelectorAll(`[data-setting-group="${group}"] [data-value]`).forEach((button) => {
      const active = button.dataset.value === value;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  const sidebar = localStorage.getItem("shilposetu_sidebar") === "collapsed" ? "Collapsed" : "Expanded";
  const state = document.querySelector("#sidebarPreference");
  if (state) state.textContent = sidebar;
}

document.querySelectorAll("[data-setting-group]").forEach((group) => {
  group.querySelectorAll("[data-value]").forEach((button) => {
    button.addEventListener("click", () => {
      const setting = group.dataset.settingGroup;
      localStorage.setItem(keys[setting], button.dataset.value);
      applyPreferences();
      render();
      toast("Display preference applied.", "success");
    });
  });
});

document.querySelector("#resetPreferences")?.addEventListener("click", () => {
  Object.values(keys).forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem("shilposetu_sidebar");
  applyPreferences();
  document.querySelector(".app-shell")?.classList.remove("sidebar-collapsed");
  render();
  toast("Interface preferences restored.", "success");
});

render();
