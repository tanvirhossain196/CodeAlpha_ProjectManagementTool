const API_BASE="/api";
export const token=()=>localStorage.getItem("shilposetu_token");

export async function api(path,options={}){
  const headers={"Content-Type":"application/json",...(options.headers||{})};
  const bearer=token();
  if(bearer) headers.Authorization=`Bearer ${bearer}`;
  const controller=options.signal?null:new AbortController();
  const timeout=controller?setTimeout(()=>controller.abort(),20000):null;
  let response;
  try{response=await fetch(`${API_BASE}${path}`,{...options,headers,signal:options.signal||controller?.signal});}
  catch(err){if(err.name==="AbortError")throw new Error("The request timed out. Please try again.");throw new Error("Unable to reach the server.");}
  finally{if(timeout)clearTimeout(timeout);}
  let body={};
  try{body=await response.json();}catch{}
  if(response.status===401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/register")){
    localStorage.removeItem("shilposetu_token"); localStorage.removeItem("shilposetu_user");
    if(!location.pathname.endsWith("login.html")) location.replace(`/login.html?next=${encodeURIComponent(location.pathname+location.search)}`);
  }
  if(!response.ok) throw new Error(body.message||`Request failed (${response.status})`);
  return body.data;
}
export const get=(p)=>api(p);
export const post=(p,data)=>api(p,{method:"POST",body:JSON.stringify(data)});
export const put=(p,data)=>api(p,{method:"PUT",body:JSON.stringify(data)});
export const patch=(p,data)=>api(p,{method:"PATCH",body:JSON.stringify(data)});
export const del=(p)=>api(p,{method:"DELETE"});
