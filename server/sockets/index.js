import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";

export function configureSockets(io){
  io.use(async(socket,next)=>{
    try{
      const token=socket.handshake.auth?.token || String(socket.handshake.headers.authorization||"").replace(/^Bearer\s+/,"");
      if(!token) return next(new Error("Authentication required"));
      const payload=jwt.verify(token,env.jwtSecret);
      const {rows}=await pool.query(`SELECT id,username,full_name FROM users WHERE id=$1 AND is_active=TRUE`,[payload.sub]);
      if(!rows[0]) return next(new Error("Invalid session"));
      socket.user=rows[0]; next();
    }catch{ next(new Error("Invalid or expired token")); }
  });

  io.on("connection",(socket)=>{
    socket.join(`user:${socket.user.id}`);
    socket.on("project:join",async(projectId,ack=()=>{})=>{
      try{
        const {rows}=await pool.query(`SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2`,[projectId,socket.user.id]);
        if(!rows[0]) return ack({ok:false,message:"Access denied"});
        socket.join(`project:${projectId}`);
        ack({ok:true});
      }catch{ ack({ok:false,message:"Unable to join project"}); }
    });
    socket.on("project:leave",(projectId)=>socket.leave(`project:${projectId}`));
  });
}
