import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import projectRoutes from "./routes/project.routes.js";
import taskRoutes,{projectTaskRouter} from "./routes/task.routes.js";
import commentRoutes,{taskCommentRouter} from "./routes/comment.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import userRoutes from "./routes/user.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import searchRoutes from "./routes/search.routes.js";
import reportRoutes from "./routes/report.routes.js";
import checklistRoutes,{taskChecklistRouter} from "./routes/checklist.routes.js";
import timeRoutes,{taskTimeRouter} from "./routes/time.routes.js";
import { notFound,errorHandler } from "./middleware/errors.js";

const app=express();
const here=dirname(fileURLToPath(import.meta.url));
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy:{
    directives:{
      defaultSrc:["'self'"],
      scriptSrc:["'self'"],
      styleSrc:["'self'","'unsafe-inline'"],
      imgSrc:["'self'","data:","https:","http:"],
      connectSrc:["'self'","ws:","wss:"],
      objectSrc:["'none'"],
      baseUri:["'self'"],
      frameAncestors:["'none'"]
    }
  }
}));
app.use(compression());
app.use(cors({origin:env.corsOrigin.split(",").map(x=>x.trim()),credentials:false}));
app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:false,limit:"1mb"}));

app.get("/api/health",(_req,res)=>res.json({success:true,message:"ShilpoSetu API is healthy"}));
app.use("/api/auth",authRoutes);
app.use("/api/projects",projectRoutes);
app.use("/api/projects",projectTaskRouter);
app.use("/api/tasks",taskRoutes);
app.use("/api/tasks",taskCommentRouter);
app.use("/api/tasks",taskChecklistRouter);
app.use("/api/tasks",taskTimeRouter);
app.use("/api/comments",commentRoutes);
app.use("/api/checklist",checklistRoutes);
app.use("/api/time",timeRoutes);
app.use("/api/notifications",notificationRoutes);
app.use("/api/users",userRoutes);
app.use("/api/dashboard",dashboardRoutes);
app.use("/api/search",searchRoutes);
app.use("/api/reports",reportRoutes);

app.use(express.static(resolve(here,"../client")));
app.get(["/","/index.html"],(_req,res)=>res.sendFile(resolve(here,"../client/index.html")));

app.use((req,res,next)=>{
  if(req.path.startsWith("/api/")) return notFound(req,res);
  res.status(404).sendFile(resolve(here,"../client/404.html"));
});
app.use(errorHandler);
export default app;
