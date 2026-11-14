'use strict';
// Enforces PL -> BLL -> DAL. PL = PL/, middleware/, app.js, server.js.
// Optional argument: root directory to check (used by the self-test).
const fs=require('fs');const path=require('path');
const root=path.resolve(process.argv[2]||path.resolve(__dirname,'..'));const errors=[];
function walk(dir){if(!fs.existsSync(dir))return [];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]).filter(f=>f.endsWith('.js'));}
const requires=src=>[...src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m=>m[1]);
const layerOf=spec=>/(^|\/)DAL(\/|$)/.test(spec)?'DAL':/(^|\/)BLL(\/|$)/.test(spec)?'BLL':/(^|\/)(PL|middleware)(\/|$)/.test(spec)?'PL':null;
const rules=[
  {layer:'PL',files:[...walk(path.join(root,'PL')),...walk(path.join(root,'middleware')),path.join(root,'app.js'),path.join(root,'server.js')],forbidden:['DAL']},
  {layer:'BLL',files:walk(path.join(root,'BLL')),forbidden:['PL']},
  {layer:'DAL',files:walk(path.join(root,'DAL')),forbidden:['BLL','PL']},
];
let scanned=0;
for(const rule of rules){
  for(const file of rule.files){
    if(!fs.existsSync(file))continue; scanned++;
    for(const spec of requires(fs.readFileSync(file,'utf8'))){
      const target=layerOf(spec);
      if(target&&rule.forbidden.includes(target))errors.push(`${rule.layer} must not import ${target}: ${path.relative(root,file).replace(/\\/g,'/')} -> ${spec}`);
    }
  }
}
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`Architecture check passed: PL -> BLL -> DAL dependency direction respected (${scanned} files scanned).`);
