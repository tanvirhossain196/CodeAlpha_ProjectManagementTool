(() => {
  "use strict";

  const THEME_KEY = "shilposetu_theme";
  const root = document.documentElement;

  const icons = {
    moon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4A8.5 8.5 0 1 0 20 15.2Z"></path>
      </svg>
    `,

    sun: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3.5"></circle>
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>
      </svg>
    `,
  };

  function getSavedTheme() {
    try {
      return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Local storage unavailable হলেও current page-এ theme কাজ করবে।
    }
  }

  function updateButton(button, theme) {
    const isDark = theme === "dark";

    const label = isDark ? "Switch to light mode" : "Switch to dark mode";

    button.innerHTML = isDark ? icons.sun : icons.moon;

    button.classList.toggle("active", isDark);

    button.setAttribute("aria-pressed", String(isDark));

    button.setAttribute("aria-label", label);

    button.title = label;
  }

  function applyTheme(theme, shouldSave = true) {
    const selectedTheme = theme === "dark" ? "dark" : "light";

    root.dataset.theme = selectedTheme;

    document.querySelectorAll("[data-theme-nav]").forEach((button) => {
      updateButton(button, selectedTheme);
    });

    if (shouldSave) {
      saveTheme(selectedTheme);
    }
  }

  function initializeThemeButton() {
    const button = document.querySelector("[data-theme-nav]");

    if (!button) return;

    updateButton(button, root.dataset.theme);

    // একই button-এ একাধিক click event যোগ হওয়া বন্ধ করবে।
    if (button.dataset.themeReady === "true") {
      return;
    }

    button.dataset.themeReady = "true";

    button.addEventListener("click", () => {
      const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";

      applyTheme(nextTheme);
    });
  }

  // CSS load হওয়ার আগেই saved theme apply করবে।
  applyTheme(getSavedTheme(), false);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeThemeButton, {
      once: true,
    });
  } else {
    initializeThemeButton();
  }

  // অন্য browser tab থেকে theme পরিবর্তন হলেও update হবে।
  window.addEventListener("storage", (event) => {
    if (event.key !== THEME_KEY) return;

    const updatedTheme = event.newValue === "dark" ? "dark" : "light";

    applyTheme(updatedTheme, false);
  });
})();
