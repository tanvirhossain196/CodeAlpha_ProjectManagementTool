import { env } from "../config/env.js";

export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, _req, res, _next) {
  const status = err.status || (err.code === "23505" ? 409 : 500);
  let message = err.message || "Internal server error.";
  if (err.code === "23505") message = "A record with this value already exists.";
  if (err.code === "23503") message = "Invalid related record.";
  const payload = { success: false, message };
  if (err.details) payload.details = err.details;
  if (env.nodeEnv !== "production" && status >= 500) payload.debug = err.stack;
  res.status(status).json(payload);
}
