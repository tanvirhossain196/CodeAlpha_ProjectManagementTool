import { readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { spawnSync } from "node:child_process";

const roots=["server","client/js","tests"];
const files=[];
async function walk(dir){
  for(const ent of await readdir(dir,{withFileTypes:true})){
    const p=join(dir,ent.name);
    if(ent.isDirectory()) await walk(p);
    else if(extname(ent.name)===".js") files.push(p);
  }
}
for(const dir of roots) await walk(dir);
let failed=false;
for(const file of files){
  const r=spawnSync(process.execPath,["--check",file],{encoding:"utf8"});
  if(r.status!==0){failed=true;console.error(`FAIL ${file}\n${r.stderr}`);}
}
if(failed) process.exit(1);
console.log(`Syntax OK: ${files.length} JavaScript files.`);
