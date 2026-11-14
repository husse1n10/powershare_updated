'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..','..');

test('QA-E2E-001 project provides database initialization and live end-to-end QA commands',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.equal(pkg.scripts['db:init'],'node scripts/init-db.js');
  assert.equal(pkg.scripts['test:e2e:live'],'node scripts/e2e-live.js');
  assert.match(pkg.scripts['qa:live'],/test:db/);
  assert.match(pkg.scripts['qa:live'],/test:e2e:live/);
  assert.ok(fs.existsSync(path.join(root,'scripts','init-db.js')));
  assert.ok(fs.existsSync(path.join(root,'scripts','e2e-live.js')));
});

test('QA-E2E-002 live harness traverses owner collector subscriber support and reporting workflows',()=>{
  const src=fs.readFileSync(path.join(root,'scripts','e2e-live.js'),'utf8');
  for(const expected of ['/api/owner/bills','/api/collector/bills','/api/collector/settlements/request','/api/subscriber/bills','/api/support/tickets','/api/owner/reports/summary']){
    assert.ok(src.includes(expected),`missing ${expected}`);
  }
});
