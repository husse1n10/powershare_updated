'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('QA-DEPLOY-001 production can serve the built React app without taking over API or Socket.IO routes',()=>{
  const app=read('app.js');
  assert.match(app,/SERVE_FRONTEND/);
  assert.match(app,/express\.static\(frontendBuild/);
  assert.match(app,/frontend\/build\/index\.html was not found/);
  assert.match(app,/api\|socket/);
});

test('QA-BRAND-001 visible application branding uses PowerShare',()=>{
  const i18n=read('../frontend/src/i18n.js');
  assert.match(i18n,/appName:\s*'PowerShare'/);
  assert.doesNotMatch(i18n,/appName:\s*'GenPlatform'/);
});
