export function cleanText(value, max = 5000) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, max);
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}
