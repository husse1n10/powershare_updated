'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validateSubscriberHardDelete}=require('../../BLL/domain/recordIntegrityRules');

test('QA-DATA-001 allows permanent deletion only for unused unlinked subscriber',()=>{
  assert.equal(validateSubscriberHardDelete({user_id:null,bill_count:0,payment_count:0,reading_count:0}),true);
});

test('QA-DATA-002 blocks hard delete when financial history exists',()=>{
  assert.throws(()=>validateSubscriberHardDelete({user_id:null,bill_count:1,payment_count:0,reading_count:0}),err=>err.code==='SUBSCRIBER_HISTORY_PROTECTED');
});

test('QA-DATA-003 blocks hard delete when subscriber has login account',()=>{
  assert.throws(()=>validateSubscriberHardDelete({user_id:14,bill_count:0,payment_count:0,reading_count:0}),err=>err.code==='SUBSCRIBER_ACCOUNT_LINKED');
});
