import {get,post,token} from "./api.js";
import {toast,setButtonLoading} from "./ui.js";

export function getStoredUser(){
  try{return JSON.parse(localStorage.getItem("shilposetu_user")||"null");}catch{return null;}
}
export function requirePageAuth(){
  if(!token()){location.replace(`/login.html?next=${encodeURIComponent(location.pathname+location.search)}`);return false;}
  return true;
}
export async function hydrateUser(){
  const user=await get("/auth/me");
  localStorage.setItem("shilposetu_user",JSON.stringify(user));
  return user;
}
export function saveSession(data){
  localStorage.setItem("shilposetu_token",data.token);
  localStorage.setItem("shilposetu_user",JSON.stringify(data.user));
}
export async function logout(){
  try{await post("/auth/logout",{});}catch{}
  localStorage.removeItem("shilposetu_token");localStorage.removeItem("shilposetu_user");location.replace("/login.html");
}
export function safeNextPath(value,origin=location.origin){
  if(!value||!value.startsWith("/")||value.startsWith("//"))return "/dashboard.html";
  try{
    const target=new URL(value,origin);
    return target.origin===origin?`${target.pathname}${target.search}${target.hash}`:"/dashboard.html";
  }catch{return "/dashboard.html";}
}
export function initLogin(){
  if(token()){location.replace("/dashboard.html");return;}
  const form=document.querySelector("#loginForm");
  form?.addEventListener("submit",async e=>{
    e.preventDefault();const btn=form.querySelector("button[type=submit]");setButtonLoading(btn,true,"Signing in...");
    try{
      const data=await post("/auth/login",{identifier:form.identifier.value,password:form.password.value});
      saveSession(data);toast("Welcome back.","success");
      const next=safeNextPath(new URLSearchParams(location.search).get("next")); location.replace(next);
    }catch(err){toast(err.message,"error");}finally{setButtonLoading(btn,false);}
  });
}
export function initRegister(){
  if(token()){location.replace("/dashboard.html");return;}
  const form=document.querySelector("#registerForm");
  form?.addEventListener("submit",async e=>{
    e.preventDefault();
    if(form.password.value!==form.confirmPassword.value) return toast("Passwords do not match.","error");
    const btn=form.querySelector("button[type=submit]");setButtonLoading(btn,true,"Creating...");
    try{
      const data=await post("/auth/register",{fullName:form.fullName.value,username:form.username.value,email:form.email.value,password:form.password.value});
      saveSession(data);location.replace("/dashboard.html");
    }catch(err){toast(err.message,"error");}finally{setButtonLoading(btn,false);}
  });
}
