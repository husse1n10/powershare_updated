'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {registrationInput,applicationInput,assignmentInput,normalizedMeter}=require('../../BLL/domain/registrationRules');
const input={full_name:'New Subscriber',username:'newsub',phone:'+96171123456',password:'QaPass123!',generator_id:5,location_address:'Beirut, building 12'};

test('QA-REG-005 account registration does not bind a generator or installation address',()=>{
  const v=registrationInput(input);assert.equal(v.generator_id,undefined);assert.equal(v.email,null);assert.equal(v.location_address,undefined);assert.equal(v.meter_number,undefined);
  const {generator_id,location_address,...account}=input;assert.equal(registrationInput(account).username,input.username);
  assert.throws(()=>registrationInput({...input,phone:'71123456'}),e=>e.statusCode===422);
  assert.throws(()=>registrationInput({...input,meter_number:'HACK1'}),e=>e.code==='METER_ASSIGNMENT_STAFF_ONLY');
});
test('QA-REG-008 provider selection is a separate validated operation',()=>{
  assert.deepEqual(applicationInput({generator_id:5,location_address:' Beirut '}),{generator_id:5,location_address:'Beirut'});
  for(const patch of [{generator_id:0},{generator_id:'wrong'},{location_address:''},{meter_number:'SELF1'}])assert.throws(()=>applicationInput({generator_id:5,location_address:'Beirut',...patch}),e=>e.statusCode===422);
});
test('QA-REG-006 validation keeps credential limits and optional email rules',()=>{
  for(const patch of [{full_name:'A'},{username:'bad user'},{password:'@bad'},{email:'bad'}])assert.throws(()=>registrationInput({...input,...patch}),e=>e.statusCode===422);
  assert.equal(registrationInput({...input,email:' USER@example.com '}).email,'user@example.com');
});
test('QA-REG-007 meter assignment rejects wrong plan IDs, invalid dates and readings',()=>{
  const valid={meter_number:' A-001 ',plan_id:4,initial_kwh_consumed:100,start_date:'2026-10-17'};
  assert.equal(assignmentInput(valid).meter_number,'A-001');
  assert.equal(normalizedMeter('a-_001'),'A001');
  for(const patch of [{meter_number:''},{meter_number:'<script>'},{plan_id:0},{initial_kwh_consumed:-1},{initial_kwh_consumed:'NaN'},{start_date:'2026-02-30'}])assert.throws(()=>assignmentInput({...valid,...patch}),e=>e.statusCode===422);
});
