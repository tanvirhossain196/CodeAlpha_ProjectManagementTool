import { AppError } from "../utils/api.js";

export const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"];
export const TASK_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
export const MEMBER_ROLES = ["OWNER", "ADMIN", "MEMBER"];

export function assert(condition, message, status = 422) {
  if (!condition) throw new AppError(message, status);
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

export function isUsername(value) {
  return /^[a-zA-Z0-9_.-]{3,32}$/.test(String(value || ""));
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

export function isDate(value) {
  if (!value) return true;
  return !Number.isNaN(Date.parse(value));
}
