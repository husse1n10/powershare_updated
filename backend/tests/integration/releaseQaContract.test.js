'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('QA-DB-008 live DB smoke checks the actual support response table name',()=>{
  const smoke=read('scripts/smoke-db.js');
  const schema=read('database/schema.sql');
  assert.match(schema,/CREATE TABLE IF NOT EXISTS support_ticket_responses/);
  assert.match(smoke,/support_ticket_responses/);
  assert.doesNotMatch(smoke,/support_replies/);
});

test('QA-SEC-016 production schema initialization does not seed known demo credentials',()=>{
  const schema=read('database/schema.sql');
  assert.doesNotMatch(schema,/PowerShare Administrator/);
  assert.doesNotMatch(schema,/admin@powershare\.local/);
  assert.doesNotMatch(schema,/Admin@123456/);
  const seed=read('database/demo-seed.sql');
  assert.match(seed,/PowerShare Administrator/);
  assert.match(seed,/Admin@123456/);
});

test('QA-SEC-017 demo seed script explicitly refuses production execution',()=>{
  const seedScript=read('scripts/seed-demo.js');
  assert.match(seedScript,/NODE_ENV/);
  assert.match(seedScript,/production/);
  assert.match(seedScript,/Demo seed is disabled/);
});

test('QA-CI-001 continuous QA workflow runs MySQL live QA and a fresh frontend build',()=>{
  const workflow=fs.readFileSync(path.resolve(ROOT,'../.github/workflows/qa.yml'),'utf8');
  assert.match(workflow,/mysql:8\.0/);
  assert.match(workflow,/npm run db:init/);
  assert.match(workflow,/npm run db:seed:demo/);
  assert.match(workflow,/npm run qa:live/);
  assert.match(workflow,/npm ci/);
  assert.match(workflow,/npm run build/);
});
