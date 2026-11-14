'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const project=path.resolve(__dirname,'../../..');
const html=fs.readFileSync(path.join(project,'frontend/public/index.html'),'utf8');
const css=fs.readFileSync(path.join(project,'frontend/src/index.css'),'utf8');
const i18n=fs.readFileSync(path.join(project,'frontend/src/i18n.js'),'utf8');

test('QA-RESP-001 responsive contract includes viewport and desktop/tablet/mobile breakpoints',()=>{
  assert.match(html,/name="viewport"[^>]*width=device-width/);
  assert.match(css,/@media \(max-width: 768px\)/);
  assert.match(css,/@media \(max-width: 480px\)/);
  assert.match(css,/@media \(max-width: 360px\)/);
});

test('QA-RESP-002 mobile navigation/layout has dedicated responsive rules',()=>{
  assert.match(css,/\.sidebar/);
  assert.match(css,/\.main-wrapper/);
  assert.match(css,/\.sidebar-overlay/);
  assert.match(css,/@media \(max-width: 768px\)[\s\S]*?\.main-wrapper/);
});

test('QA-RTL-001 Arabic RTL contract defines rtl direction and mirrored layout rules',()=>{
  assert.match(i18n,/dir:\s*'rtl'/);
  assert.match(css,/\[dir="rtl"\] \.sidebar/);
  assert.match(css,/\[dir="rtl"\] \.main-wrapper/);
  assert.match(css,/\[dir="rtl"\] \.form-select/);
});
