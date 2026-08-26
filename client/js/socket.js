import {token} from "./api.js";
import {toast,refreshNotificationCount} from "./ui.js";
let socket;
function setConnectionState(state){
  let indicator=document.querySelector("[data-connection-state]");
  if(!indicator&&document.querySelector(".top-actions")){
    indicator=document.createElement("span");indicator.className="connection-state";indicator.dataset.connectionState="";
    document.querySelector(".top-actions").prepend(indicator);
  }
  if(!indicator)return;
  indicator.dataset.state=state;
  indicator.innerHTML=`<span class="status-dot"></span><span>${state==="online"?"Live":"Reconnecting"}</span>`;
  indicator.title=state==="online"?"Live updates connected":"Live updates are reconnecting";
}
export function connectSocket(){
  if(!token()||typeof io==="undefined") return null;
  socket=io({auth:{token:token()}});
  socket.on("connect",()=>setConnectionState("online"));
  socket.on("disconnect",()=>setConnectionState("offline"));
  socket.on("connect_error",()=>setConnectionState("offline"));
  socket.on("notification:new",n=>{toast(n.title||"New notification","success");refreshNotificationCount();});
  return socket;
}
export function joinProject(projectId){socket?.emit("project:join",projectId,()=>{});}
export function on(event,handler){socket?.on(event,handler);}
export function off(event,handler){socket?.off(event,handler);}
