import http from "node:http";
import { Server } from "socket.io";
import app from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { configureSockets } from "./sockets/index.js";

const server=http.createServer(app);
const io=new Server(server,{cors:{origin:env.corsOrigin.split(",").map(x=>x.trim())}});
app.set("io",io);
configureSockets(io);

async function start(){
  await pool.query("SELECT 1");
  server.listen(env.port,()=>console.log(`ShilpoSetu running at http://localhost:${env.port}`));
}
start().catch(err=>{console.error("Startup failed:",err);process.exit(1);});

async function shutdown(){
  io.close();
  server.close(async()=>{await pool.end();process.exit(0);});
}
process.on("SIGTERM",shutdown);
process.on("SIGINT",shutdown);
