'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validateProductionSecurityConfig}=require('../../BLL/domain/securityConfigRules');

test('QA-SEC-004 production rejects missing or weak JWT secrets',()=>{
  const r=validateProductionSecurityConfig({NODE_ENV:'production',JWT_SECRET:'short',JWT_REFRESH_SECRET:''});
  assert.equal(r.valid,false);
  assert.equal(r.errors.length,2);
});

test('QA-SEC-005 production accepts separate strong JWT secrets',()=>{
  const r=validateProductionSecurityConfig({
    NODE_ENV:'production',
    JWT_SECRET:'access-secret-abcdefghijklmnopqrstuvwxyz-123456',
    JWT_REFRESH_SECRET:'refresh-secret-abcdefghijklmnopqrstuvwxyz-654321'
  });
  assert.equal(r.valid,true);
});
