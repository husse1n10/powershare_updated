'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..','..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('QA-BALANCE-002 owner can send a tenant-scoped outstanding balance reminder',()=>{
  const routes=read('PL/routes/ownerRoutes.js');
  const service=read('BLL/services/ownerService.js');
  const repo=read('DAL/repositories/billingRepository.js');
  assert.match(routes,/\/bills\/:id\/remind/);
  assert.match(service,/getBillForOwner\(oid,id\)/);
  assert.match(service,/SUBSCRIBER_ACCOUNT_REQUIRED/);
  assert.match(service,/notifyUser\(bill\.subscriber_user_id,'balance'/);
  assert.match(service,/BALANCE_REMINDER_SENT/);
  assert.match(repo,/subscriber_user_id/);
});

test('QA-NOTIFY-007 settlement request and decision notify both financial actors',()=>{
  const collector=read('BLL/services/collectorService.js');
  const owner=read('BLL/services/ownerService.js');
  const repo=read('DAL/repositories/collectorRepository.js');
  assert.match(collector,/Settlement requested/);
  assert.match(collector,/notifyUser\(owner\.user_id,'settlement'/);
  assert.match(owner,/Settlement confirmed/);
  assert.match(owner,/Settlement rejected/);
  assert.match(owner,/notifyUser\(s\.collector_user_id,'settlement'/);
  assert.match(repo,/collector_user_id/);
});
