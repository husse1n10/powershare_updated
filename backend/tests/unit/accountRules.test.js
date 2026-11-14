'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validateUsername,validatePassword,validateRoleCreationContext}=require('../../BLL/domain/accountRules');

test('QA-AUTH-001 accepts a four-character alphanumeric password',()=>{
  assert.equal(validatePassword('a123'),'a123');
});

test('QA-AUTH-002 rejects passwords shorter than four characters',()=>{
  assert.throws(()=>validatePassword('123'),err=>err.code==='WEAK_PASSWORD');
});

test('QA-AUTH-003 accepts exactly four digits as requested by client',()=>{
  assert.equal(validatePassword('1234'),'1234');
});

test('QA-AUTH-004 rejects unsupported password symbols for current business rule',()=>{
  assert.throws(()=>validatePassword('12@4'),err=>err.code==='INVALID_PASSWORD_FORMAT');
});

test('QA-AUTH-005 normalizes and validates username',()=>{
  assert.equal(validateUsername('  owner_1  '),'owner_1');
});

test('QA-AUTH-006 collector creation requires an owner before any account is created',()=>{
  assert.throws(()=>validateRoleCreationContext('collector',{}),e=>e.code==='OWNER_REQUIRED');
  assert.equal(validateRoleCreationContext('collector',{ownerId:1}),true);
});
