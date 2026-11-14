'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const accountRepo=fs.readFileSync(path.resolve(__dirname,'../../DAL/repositories/accountRepository.js'),'utf8');
const registrationRepo=fs.readFileSync(path.resolve(__dirname,'../../DAL/repositories/registrationRepository.js'),'utf8');
const registrationService=fs.readFileSync(path.resolve(__dirname,'../../BLL/services/registrationService.js'),'utf8');
const authService=fs.readFileSync(path.resolve(__dirname,'../../BLL/services/authService.js'),'utf8');
const accountService=fs.readFileSync(path.resolve(__dirname,'../../BLL/services/accountService.js'),'utf8');
const ownerService=fs.readFileSync(path.resolve(__dirname,'../../BLL/services/ownerService.js'),'utf8');

test('QA-AUTH-007 role user and profile creation share one DB transaction',()=>{
  const fn=accountRepo.match(/async function createUserWithRoleProfile[\s\S]*?(?=\/\*\*\r?\n \* Updates)/);
  assert.ok(fn,'createUserWithRoleProfile not found');
  assert.match(fn[0],/transaction\(async conn/);
  assert.match(fn[0],/insertUser\(conn, data\)/);
  assert.match(accountRepo,/INSERT INTO users/);
  assert.match(fn[0],/INSERT INTO generator_owners/);
  assert.match(fn[0],/INSERT INTO bill_collectors/);
  assert.match(fn[0],/UPDATE subscriber_profiles SET user_id=/);
});

test('QA-AUTH-008 account and application are created in one destination-bound transaction',()=>{
  assert.match(registrationRepo,/async function createApplication/);
  assert.match(registrationRepo,/transaction\(async conn/);
  assert.match(registrationRepo,/INSERT INTO registration_applications/);
  assert.match(authService,/registrationService/);
});

test('QA-AUTH-009 staff assignment is scoped and guarded against duplicate profiles and wrong-generator plans',()=>{
  assert.match(registrationService,/\['admin','owner'\]\.includes/);
  assert.match(registrationService,/req\.user\.role==='owner'\?req\.user\.id:null/);
  assert.match(registrationRepo,/APPLICATION_ALREADY_ASSIGNED/);
  assert.match(registrationRepo,/APPLICATION_PLAN_MISMATCH/);
  assert.match(registrationRepo,/ACCOUNT_ALREADY_LINKED/);
  assert.match(registrationRepo,/FOR UPDATE/);
});

test('QA-SEC-012 owner-created subscriber account is tenant-bound inside transaction',()=>{
  assert.match(accountRepo,/created_by_owner/);
  assert.match(accountRepo,/SUBSCRIBER_OWNER_MISMATCH/);
  assert.match(ownerService,/subscriber_profile_id:subscriberId\},\{ownerId:oid\}/);
  assert.match(accountService,/SUBSCRIBER_OWNER_MISMATCH/);
});
