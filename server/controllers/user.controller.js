import { asyncHandler, ok, AppError } from "../utils/api.js";
import { pool } from "../db/pool.js";
import { cleanText } from "../utils/security.js";

export const list=asyncHandler(async(req,res)=>{
  const q=String(req.query.q||"").trim();
  const params=[]; let where="WHERE is_active=TRUE";
  if(q){params.push(`%${q.slice(0,100)}%`);where+=` AND (full_name ILIKE $1 OR username ILIKE $1 OR email ILIKE $1)`;}
  const {rows}=await pool.query(
    `SELECT id,full_name,username,email,avatar_url,job_title,department,location,created_at
     FROM users ${where} ORDER BY full_name LIMIT 30`,params
  );
  ok(res,rows,"Users loaded.");
});
export const get=asyncHandler(async(req,res)=>{
  const {rows}=await pool.query(
    `SELECT id,full_name,username,email,avatar_url,job_title,department,phone,location,bio,timezone,created_at
     FROM users WHERE id=$1 AND is_active=TRUE`,[req.params.id]
  );
  ok(res,rows[0]||null,rows[0]?"User loaded.":"User not found.",rows[0]?200:404);
});
export const search=list;
export const updateProfile=asyncHandler(async(req,res)=>{
  const fullName=cleanText(req.body.fullName,120);
  const avatarUrl=String(req.body.avatarUrl||"").trim().slice(0,500);
  if(avatarUrl && !/^https?:\/\/[^\s]+$/i.test(avatarUrl)) {
    throw new AppError("Avatar URL must start with http:// or https://.",422);
  }
  const jobTitle=cleanText(req.body.jobTitle,100);
  const department=cleanText(req.body.department,100);
  const phone=cleanText(req.body.phone,40);
  const location=cleanText(req.body.location,140);
  const bio=cleanText(req.body.bio,600);
  const timezone=cleanText(req.body.timezone,80)||"Asia/Dhaka";
  const {rows}=await pool.query(
    `UPDATE users SET full_name=COALESCE(NULLIF($1,''),full_name),avatar_url=NULLIF($2,''),
      job_title=$3,department=$4,phone=$5,location=$6,bio=$7,timezone=$8,updated_at=NOW()
     WHERE id=$9
     RETURNING id,full_name,username,email,avatar_url,job_title,department,phone,location,bio,timezone,created_at`,
    [fullName,avatarUrl,jobTitle,department,phone,location,bio,timezone,req.user.id]
  );
  ok(res,rows[0],"Profile updated.");
});
