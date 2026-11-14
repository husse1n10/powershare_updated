'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..','..');
const reqs=JSON.parse(fs.readFileSync(path.join(root,'qa','requirements.json'),'utf8'));
const esc=v=>String(v??'').replace(/\|/g,'\\|');
const tick=v=>`\`${String(v).replace(/`/g,'')}\``;
let out='# PowerShare Requirements Traceability Matrix\n\n';
out+='The proposal Scope of Work is treated as the functional baseline. A feature is not considered complete by UI presence alone; it must have implementation files and at least one automated or manual verification reference.\n\n';
out+='| Requirement | Feature | Status | Implementation | Verification |\n';
out+='|---|---|---|---|---|\n';
for(const r of reqs){
  const impl=(r.implementation||[]).map(tick).join('<br>');
  const tests=(r.test_ids||[]).map(tick).join(', ');
  out+=`| ${esc(r.id)} | ${esc(r.title)} | ${esc(r.status)} | ${impl} | ${tests} |\n`;
}
fs.writeFileSync(path.join(root,'qa','requirements-traceability.md'),out);
console.log(`Traceability matrix generated: ${reqs.length} requirements.`);
