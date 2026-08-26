export const ok = (res, data = null, message = "Success", status = 200) =>
  res.status(status).json({ success: true, message, data });

export const fail = (res, message, status = 400, details = undefined) =>
  res.status(status).json({ success: false, message, ...(details ? { details } : {}) });

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export class AppError extends Error {
  constructor(message, status = 500, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
