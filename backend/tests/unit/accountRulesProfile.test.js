'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validateUsername,validatePassword,validateProfileData}=require('../../BLL/domain/accountRules');

test('QA-AUTH-010 account credentials enforce database-safe maximum lengths',()=>{
  assert.throws(()=>validateUsername('u'.repeat(81)),err=>err?.code==='INVALID_USERNAME');
  assert.throws(()=>validatePassword('A'.repeat(129)),err=>err?.code==='INVALID_PASSWORD_LENGTH');
  assert.equal(validateUsername('valid.user_01'),'valid.user_01');
});

test('QA-PROFILE-002 profile data validates name email phone and preferred language',()=>{
  assert.equal(validateProfileData({full_name:'Rony Test',email:'rony@example.com',phone:'+96171123456',preferred_language:'en'}),true);
  assert.throws(()=>validateProfileData({full_name:'A'}),err=>err?.code==='INVALID_FULL_NAME');
  assert.throws(()=>validateProfileData({email:'not-an-email'}),err=>err?.code==='INVALID_EMAIL');
  assert.throws(()=>validateProfileData({phone:'<script>'}),err=>err?.code==='INVALID_PHONE');
  assert.throws(()=>validateProfileData({preferred_language:'fr'}),err=>err?.code==='INVALID_LANGUAGE');
});
