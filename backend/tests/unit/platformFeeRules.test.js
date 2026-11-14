'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validatePeriod,periodRange,normalizeFeeRate,calculateMonthlyFee}=require('../../BLL/domain/platformFeeRules');

test('QA-FEE-001 calculates monthly platform fee per active subscriber',()=>{
  assert.equal(calculateMonthlyFee(37,0.10),3.7);
});

test('QA-FEE-002 rounds platform fees to four decimals',()=>{
  assert.equal(calculateMonthlyFee(3,0.33333),1);
});

test('QA-FEE-003 rejects invalid billing month',()=>{
  assert.throws(()=>validatePeriod(13,2026),(err)=>err.code==='INVALID_MONTH');
});

test('QA-FEE-004 February range is correct for non-leap year',()=>{
  assert.deepEqual(periodRange(2,2026),{month:2,year:2026,start:'2026-02-01',end:'2026-02-28'});
});

test('QA-FEE-005 normalizes invalid fee rate to default',()=>{
  assert.equal(normalizeFeeRate('bad',0.10),0.10);
});
