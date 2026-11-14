'use strict';
const fs=require('fs');const path=require('path');const {spawnSync}=require('child_process');const root=path.resolve(__dirname,'..');const ignore=new Set(['node_modules']);
function walk(dir){let out=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(ignore.has(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())out=out.concat(walk(p));else if(p.endsWith('.js'))out.push(p);}return out;}
let failed=false;for(const f of walk(root)){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0){failed=true;console.error(`Syntax error in ${path.relative(root,f)}\n${r.stderr}`);}}
if(failed)process.exit(1);console.log('JavaScript syntax check passed.');
