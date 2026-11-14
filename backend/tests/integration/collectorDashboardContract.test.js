'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const project=path.resolve(__dirname,'../../..');
const app=fs.readFileSync(path.join(project,'frontend/src/App.js'),'utf8');
const layout=fs.readFileSync(path.join(project,'frontend/src/components/Layout/Layout.js'),'utf8');
const dashboard=fs.readFileSync(path.join(project,'frontend/src/components/Collector/CollectorDashboard.js'),'utf8');
const service=fs.readFileSync(path.join(project,'backend/BLL/services/collectorService.js'),'utf8');

test('QA-COL-DASH-001 collector has a dedicated dashboard and separate bills route',()=>{
  assert.match(app,/path="\/collector"[\s\S]*?<CollectorDashboard/);
  assert.match(app,/path="\/collector\/bills"[\s\S]*?<CollectorBills/);
  assert.match(layout,/to:\s*'\/collector'.*dashboard/);
  assert.match(layout,/to:\s*'\/collector\/bills'/);
});

test('QA-COL-DASH-002 collector dashboard exposes assigned subscribers bills wallet and settlement summaries',()=>{
  assert.match(dashboard,/api\.get\('\/collector\/dashboard'\)/);
  assert.match(dashboard,/api\.get\('\/collector\/wallet'\)/);
  assert.match(dashboard,/assigned_subscribers/);
  assert.match(dashboard,/bills_to_collect/);
  assert.match(dashboard,/available_lbp/);
  assert.match(dashboard,/recent_settlements/);
  assert.match(service,/assigned_subscribers:subs\.length/);
  assert.match(service,/bills_to_collect:bills\.filter/);
});
