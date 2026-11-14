'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const project=path.resolve(__dirname,'../../..');
const routes=fs.readFileSync(path.join(project,'backend/PL/routes/authRoutes.js'),'utf8');
const service=fs.readFileSync(path.join(project,'backend/BLL/services/authService.js'),'utf8');

test('QA-SEC-014 authentication endpoints bound credential and profile input sizes',()=>{
  assert.match(routes,/\/login'[\s\S]*?max:190[\s\S]*?max:128/);
  assert.match(routes,/\/register'[\s\S]*?max:150[\s\S]*?max:80[\s\S]*?max:128/);
  assert.match(routes,/\/profile'[\s\S]*?preferred_language'[\s\S]*?isIn\(\['en','ar'\]\)/);
  assert.match(routes,/\/change-password'[\s\S]*?max:128/);
  assert.match(service,/validateProfileData\(data\)/);
});
