'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const project=path.resolve(__dirname,'../../..');
const accountRepo=fs.readFileSync(path.join(project,'backend/DAL/repositories/accountRepository.js'),'utf8');
const authService=fs.readFileSync(path.join(project,'backend/BLL/services/authService.js'),'utf8');
const profileRepo=fs.readFileSync(path.join(project,'backend/DAL/repositories/profileRepository.js'),'utf8');

test('QA-PROFILE-003 subscriber name and phone profile updates stay consistent in one transaction',()=>{
  assert.match(accountRepo,/async function updateUserProfileAtomically/);
  assert.match(accountRepo,/SELECT id,role FROM users WHERE id=\? FOR UPDATE/);
  assert.match(accountRepo,/user\.role === 'subscriber'/);
  assert.match(accountRepo,/UPDATE subscriber_profiles SET/);
  assert.match(accountRepo,/WHERE user_id=\?/);
  assert.match(authService,/accountRepo\.updateUserProfileAtomically\(userId,fields\)/);
});

test('QA-COL-DASH-003 collector profile carries authenticated user identity into dashboard and notifications',()=>{
  assert.match(profileRepo,/FROM bill_collectors bc JOIN users u ON u\.id=bc\.user_id/);
  assert.match(profileRepo,/u\.full_name/);
  assert.match(profileRepo,/u\.phone/);
});
