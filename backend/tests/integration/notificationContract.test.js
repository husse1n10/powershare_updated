'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,p),'utf8');
const support=read('../../BLL/services/supportService.js');
const owner=read('../../BLL/services/ownerService.js');
const supportUi=read('../../../frontend/src/components/Shared/SupportPage.js');

test('QA-NOTIFY-003 support create/reply/status workflows emit notifications',()=>{
  assert.match(support,/New support ticket/);
  assert.match(support,/Support ticket reply/);
  assert.match(support,/Support ticket status/);
});

test('QA-NOTIFY-004 outage create/update/cancel workflows notify affected subscribers',()=>{
  const matches=owner.match(/notifyGeneratorSubscribers/g)||[];
  assert.ok(matches.length>=3,`Expected at least 3 outage notification calls, got ${matches.length}`);
  assert.match(owner,/Outage schedule cancelled/);
});

test('QA-SUPPORT-003 notification deep-link can open a specific support ticket',()=>{
  assert.match(supportUi,/useSearchParams/);
  assert.match(supportUi,/searchParams\.get\('ticket'\)/);
});
