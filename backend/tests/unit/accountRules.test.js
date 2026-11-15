'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validateUsername,validatePassword,validateRoleCreationContext}=require('../../BLL/domain/accountRules');

test('QA-AUTH-001 accepts a strong eight-character password',()=>{
  assert.equal(validatePassword('Abc123!x'),'Abc123!x');
});

test('QA-AUTH-002 rejects passwords shorter than eight characters',()=>{
  assert.throws(()=>validatePassword('Ab1!xyz'),err=>err.code==='WEAK_PASSWORD');
});

test('QA-AUTH-003 rejects missing character classes and whitespace',()=>{
  for(const value of ['12345678','abcdefgh','ABCDEFGH','Abcd1234','Abcd123! '])assert.throws(()=>validatePassword(value),err=>err.code==='INVALID_PASSWORD_FORMAT');
});

test('QA-AUTH-004 accepts symbols and rejects bcrypt-truncated passwords',()=>{
  assert.equal(validatePassword('Abc123!x'),'Abc123!x');
  assert.equal(validatePassword('Aa1!'+ 'x'.repeat(68)).length,72);
  assert.throws(()=>validatePassword('Aa1!'+ 'x'.repeat(69)),err=>err.code==='INVALID_PASSWORD_LENGTH');
});

test('QA-AUTH-005 normalizes and validates username',()=>{
  assert.equal(validateUsername('  owner_1  '),'owner_1');
});

test('QA-AUTH-006 collector creation requires an owner before any account is created',()=>{
  assert.throws(()=>validateRoleCreationContext('collector',{}),e=>e.code==='OWNER_REQUIRED');
  assert.equal(validateRoleCreationContext('collector',{ownerId:1}),true);
});
