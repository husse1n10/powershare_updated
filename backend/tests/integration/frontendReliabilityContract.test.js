'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const project=path.resolve(__dirname,'../../..');
const app=fs.readFileSync(path.join(project,'frontend/src/App.js'),'utf8');
const boundary=fs.readFileSync(path.join(project,'frontend/src/components/Shared/ErrorBoundary.js'),'utf8');
const layout=fs.readFileSync(path.join(project,'frontend/src/components/Layout/Layout.js'),'utf8');
const css=fs.readFileSync(path.join(project,'frontend/src/index.css'),'utf8');
const i18n=fs.readFileSync(path.join(project,'frontend/src/i18n.js'),'utf8');

test('QA-UI-ERR-001 protected role pages are wrapped by a React error boundary',()=>{
  assert.match(app,/import ErrorBoundary/);
  assert.match(app,/<ErrorBoundary>[\s\S]*?<Suspense/);
  assert.match(boundary,/getDerivedStateFromError/);
  assert.match(boundary,/componentDidCatch/);
  assert.match(boundary,/Try again/);
});

test('QA-A11Y-001 authenticated layout has a keyboard skip link to main content',()=>{
  assert.match(layout,/className="skip-link" href="#main-content"/);
  assert.match(layout,/id="main-content"/);
  assert.match(css,/\.skip-link:focus\s*\{\s*transform:\s*translateY\(0\)/);
});

test('QA-RTL-002 role navigation labels have Arabic translations for operational pages',()=>{
  for (const key of ['reports','auditLog','notifications','support','security','collectorAssignments','billsInvoices','consumption','payments','collectorDashboard']) {
    assert.match(i18n,new RegExp(`${key}:\\s*'[^']+'`));
  }
  assert.match(i18n,/collectorDashboard:\s*'لوحة تحكم المحصّل'/);
  assert.match(layout,/t\.notifications/);
  assert.match(layout,/t\.support/);
  assert.match(layout,/t\.security/);
});
