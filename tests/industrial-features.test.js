import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { safeNextPath } from "../client/js/auth.js";
import { escapeHtml, fmtDuration } from "../client/js/ui.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("blocks external and protocol-relative post-login redirects", () => {
  const origin = "https://workspace.example";
  assert.equal(safeNextPath("/projects.html?id=123", origin), "/projects.html?id=123");
  assert.equal(safeNextPath("//attacker.example/steal", origin), "/dashboard.html");
  assert.equal(safeNextPath("https://attacker.example/steal", origin), "/dashboard.html");
  assert.equal(safeNextPath("javascript:alert(1)", origin), "/dashboard.html");
});

test("formats operational UI values safely", () => {
  assert.equal(fmtDuration(0), "0m");
  assert.equal(fmtDuration(135), "2h 15m");
  assert.equal(escapeHtml(`<script>alert("x")</script>`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
});

test("ships all industrial database structures and API mounts", async () => {
  const [migration, app] = await Promise.all([
    readFile(resolve(projectRoot, "database/migrations/002_industrial_features.sql"), "utf8"),
    readFile(resolve(projectRoot, "server/app.js"), "utf8")
  ]);
  for (const structure of ["task_checklist_items", "task_time_entries", "estimated_minutes", "project_code", "is_starred"]) {
    assert.match(migration, new RegExp(structure));
  }
  for (const mount of ["/api/reports", "/api/checklist", "/api/time"]) assert.match(app, new RegExp(mount));
});

test("every page includes the responsive industrial design layer", async () => {
  const clientDir = resolve(projectRoot, "client");
  const htmlFiles = (await readdir(clientDir)).filter((file) => file.endsWith(".html"));
  assert.equal(htmlFiles.length, 14);
  for (const file of htmlFiles) {
    const html = await readFile(resolve(clientDir, file), "utf8");
    assert.match(html, /name="viewport"/);
    assert.match(html, /\/css\/industrial\.css/);
    assert.doesNotMatch(html, /ForgeBoard/i);
  }
  const css = await readFile(resolve(clientDir, "css/industrial.css"), "utf8");
  assert.match(css, /sidebar-collapsed/);
  assert.match(css, /data-theme="dark"/);
  assert.match(css, /max-width:1024px/);
  assert.match(css, /max-width:640px/);
  assert.match(css, /prefers-reduced-motion/);
});

test("sidebar controls and theme policy follow the workspace defaults", async () => {
  const clientDir = resolve(projectRoot, "client");
  const [ui, css, settings] = await Promise.all([
    readFile(resolve(clientDir, "js/ui.js"), "utf8"),
    readFile(resolve(clientDir, "css/industrial.css"), "utf8"),
    readFile(resolve(clientDir, "settings.html"), "utf8")
  ]);
  assert.match(ui, /THEME_POLICY_VERSION = "light-default-v1"/);
  assert.match(ui, /sidebarHeader\.append\(collapse\)/);
  assert.match(ui, /class="sidebar-action-icon">\$\{SHELL_ICONS\.logout\}/);
  assert.match(css, /\.sidebar-footer\{display:grid/);
  assert.match(css, /\.mobile-close-icon\{display:none!important\}/);
  assert.match(settings, /data-value="light"/);
  assert.match(settings, /data-value="dark"/);
  assert.doesNotMatch(settings, /data-value="system"/);
});

test("landing navigation stays fixed and footer credit remains inside the dark footer", async () => {
  const clientDir = resolve(projectRoot, "client");
  const [index, css] = await Promise.all([
    readFile(resolve(clientDir, "index.html"), "utf8"),
    readFile(resolve(clientDir, "css/industrial.css"), "utf8")
  ]);
  assert.match(index, /<footer class="industrial-footer site-footer">[\s\S]*class="footer-credit"[\s\S]*<\/footer>/);
  assert.match(index, /Md Tanvir Hossain/);
  assert.match(css, /\.landing-header\{position:fixed/);
  assert.match(css, /\.landing-page\{min-height:100vh;display:flex;flex-direction:column;background:#06101b\}/);
});
