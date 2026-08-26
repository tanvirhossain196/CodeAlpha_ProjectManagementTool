import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/api.js";
import { cleanText, normalizeEmail, normalizeUsername } from "../utils/security.js";
import { assert, isEmail, isUsername } from "../validators/common.js";

export async function register(payload) {
  const fullName = cleanText(payload.fullName, 120);
  const username = normalizeUsername(payload.username);
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");

  assert(fullName.length >= 2, "Full name must be at least 2 characters.");
  assert(isUsername(username), "Username must be 3-32 characters and use letters, numbers, _, . or -.");
  assert(isEmail(email), "Invalid email address.");
  assert(password.length >= 8, "Password must be at least 8 characters.");
  assert(password.length <= 128, "Password is too long.");

  const duplicate = await pool.query(
    `SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1`, [email, username]
  );
  if (duplicate.rows[0]) throw new AppError("Email or username already exists.", 409);

  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const { rows } = await pool.query(
    `INSERT INTO users(full_name, username, email, password_hash)
     VALUES($1,$2,$3,$4)
     RETURNING id,full_name,username,email,avatar_url,job_title,department,phone,location,bio,timezone,created_at`,
    [fullName, username, email, passwordHash]
  );
  return issueSession(rows[0]);
}

export async function login(identifier, password) {
  const normalized = String(identifier || "").trim().toLowerCase();
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE (email = $1 OR username = $1) AND is_active = TRUE LIMIT 1`,
    [normalized]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(String(password || ""), user.password_hash))) {
    throw new AppError("Invalid email/username or password.", 401);
  }
  return issueSession({
    id: user.id, full_name: user.full_name, username: user.username,
    email: user.email, avatar_url: user.avatar_url, job_title: user.job_title,
    department: user.department, phone: user.phone, location: user.location,
    bio: user.bio, timezone: user.timezone, created_at: user.created_at
  });
}

function issueSession(user) {
  const token = jwt.sign({ sub: user.id, username: user.username }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    issuer: "shilposetu"
  });
  return { token, user };
}
