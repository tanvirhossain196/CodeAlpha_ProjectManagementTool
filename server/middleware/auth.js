import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/api.js";
import { pool } from "../db/pool.js";

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new AppError("Authentication required.", 401);
    const payload = jwt.verify(token, env.jwtSecret);
    const { rows } = await pool.query(
      `SELECT id,full_name,username,email,avatar_url,job_title,department,phone,location,bio,timezone,created_at
       FROM users WHERE id = $1 AND is_active = TRUE`,
      [payload.sub]
    );
    if (!rows[0]) throw new AppError("Session is no longer valid.", 401);
    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return next(new AppError("Invalid or expired token.", 401));
    }
    next(err);
  }
}
