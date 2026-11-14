'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ownerService=fs.readFileSync(path.resolve(__dirname,'../../BLL/services/ownerService.js'),'utf8');
const generatorRepo=fs.readFileSync(path.resolve(__dirname,'../../DAL/repositories/generatorRepository.js'),'utf8');
const app=fs.readFileSync(path.resolve(__dirname,'../../../frontend/src/App.js'),'utf8');

test('QA-SEC-006 subscriber plan changes are revalidated against current owner',()=>{
  assert.match(ownerService,/d\.plan_id!==undefined&&!await generatorRepo\.findPlan\(oid,d\.plan_id\)/);
  assert.match(ownerService,/planId&&!await generatorRepo\.findPlan\(oid,planId\)/);
});

test('QA-SEC-007 subscriber main meter is restricted to current owner',()=>{
  assert.match(generatorRepo,/owner_main_meters WHERE id=\? AND owner_id=\?/);
  assert.match(ownerService,/generatorRepo\.findMainMeter\(oid,d\.main_meter_id\)/);
});

test('QA-UI-001 admin routes do not incorrectly open owner-only screens',()=>{
  const ownerRoutes=[...app.matchAll(/path="\/owner[^\"]*"[\s\S]*?roles=\{\[([^\]]+)\]\}/g)];
  assert.ok(ownerRoutes.length>=5,'Expected protected owner routes');
  for(const match of ownerRoutes)assert.doesNotMatch(match[1],/admin/);
});
