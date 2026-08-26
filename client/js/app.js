import {requirePageAuth,hydrateUser,logout} from "./auth.js";
import {applyPreferences,initShell} from "./ui.js";
import {connectSocket} from "./socket.js";

applyPreferences();
const pauseForNavigation=()=>new Promise(()=>{});

export async function boot(){
  if(!requirePageAuth())return pauseForNavigation();
  try{
    const user=await hydrateUser();
    await initShell(user);
    connectSocket();
    return user;
  }catch{
    localStorage.removeItem("shilposetu_token");
    localStorage.removeItem("shilposetu_user");
    location.replace("/login.html");
    return pauseForNavigation();
  }
}
window.addEventListener("shilposetu:logout",logout);
