'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {ensureBillPayable,validateCombineCandidates,outstandingFromBills}=require('../../BLL/domain/financialIntegrityRules');

test('QA-FIN-001 carried-forward bill cannot receive another payment',()=>{
  assert.throws(()=>ensureBillPayable({status:'carried_forward',remaining_balance_lbp:100000}),e=>e.code==='BILL_NOT_PAYABLE');
});

test('QA-FIN-002 paid bill cannot receive another payment',()=>{
  assert.throws(()=>ensureBillPayable({status:'paid',remaining_balance_lbp:0}),e=>e.code==='BILL_NOT_PAYABLE');
});

test('QA-FIN-003 open bill with remaining balance is payable',()=>{
  assert.equal(ensureBillPayable({status:'partially_paid',remaining_balance_lbp:1000}),true);
});

test('QA-FIN-004 combination rejects bills containing carried previous balance',()=>{
  const rows=[
    {subscription_id:1,status:'unpaid',previous_balance_lbp:0},
    {subscription_id:1,status:'unpaid',previous_balance_lbp:500000}
  ];
  assert.throws(()=>validateCombineCandidates(rows),e=>e.code==='COMBINE_CARRY_FORWARD');
});

test('QA-FIN-005 outstanding summary ignores historical carried-forward and paid bills',()=>{
  const o=outstandingFromBills([
    {status:'carried_forward',remaining_balance_lbp:1000,remaining_balance_usd:1},
    {status:'paid',remaining_balance_lbp:0,remaining_balance_usd:0},
    {status:'unpaid',remaining_balance_lbp:2500,remaining_balance_usd:2.5},
    {status:'partially_paid',remaining_balance_lbp:500,remaining_balance_usd:.5}
  ]);
  assert.deepEqual(o,{lbp:3000,usd:3});
});
