'use strict';
const test=require('node:test'); const assert=require('node:assert/strict');
const {validateMeterReading,calculateTieredEnergyCost,calculateInvoice,applyPayment}=require('../../BLL/domain/billingRules');

test('QA-BILL-001 rejects current reading below previous',()=>{ const r=validateMeterReading(99,100); assert.equal(r.valid,false); });
test('QA-BILL-002 applies the above-threshold unit price to full monthly usage',()=>{ assert.equal(calculateTieredEnergyCost(150,{threshold_kwh:100,base_cost_below_lbp:1000,base_cost_above_lbp:1500}),225000); });
test('QA-BILL-003 preserves invoice exchange rate in calculated result',()=>{ const r=calculateInvoice({consumption:100,pricing:{threshold_kwh:100,base_cost_below_lbp:1000,maintenance_lbp:50000},vatEnabled:false,usdLbpRate:90000}); assert.equal(r.usdLbpRate,90000); assert.equal(r.totalTtcLbp,150000); assert.equal(r.totalUsd,1.67); });
test('QA-BILL-004 fixed billing is all-in: converts USD and ignores maintenance/VAT',()=>{ const r=calculateInvoice({fixedAmountEnabled:true,fixedAmountUsd:50,pricing:{maintenance_lbp:500000},vatEnabled:true,vatRate:11,usdLbpRate:90000}); assert.equal(r.baseAmountLbp,4500000); assert.equal(r.maintenanceLbp,0); assert.equal(r.vatAmountLbp,0); assert.equal(r.totalUsd,50); });
test('QA-PAY-001 partial payment retains remaining balance',()=>{ const r=applyPayment({amountDueLbp:9000000,amountDueUsd:100,paymentAmountUsd:30,usdLbpRate:90000}); assert.equal(r.status,'partially_paid'); assert.equal(r.remainingBalanceUsd,70); assert.equal(r.remainingBalanceLbp,6300000); });
test('QA-PAY-002 full payment marks paid',()=>{ const r=applyPayment({amountDueLbp:9000000,amountDueUsd:100,paymentAmountUsd:100,usdLbpRate:90000}); assert.equal(r.status,'paid'); assert.equal(r.remainingBalanceUsd,0); });

test('QA-PAY-003 rejects overpayment beyond remaining balance',()=>{ assert.throws(()=>applyPayment({amountDueLbp:9000000,amountDueUsd:100,alreadyReceivedUsd:90,alreadyReceivedLbp:8100000,paymentAmountUsd:20,usdLbpRate:90000}),/cannot exceed/i); });

test('QA-BILL-005 invoice number uses the owner configured prefix',()=>{
  const {buildInvoiceNumber}=require('../../BLL/domain/billingRules');
  assert.equal(buildInvoiceNumber({prefix:' rhma ',ownerId:2,year:2026,month:9,suffix:'ab12cd'}),'RHMA-2-202609-AB12CD');
});

test('QA-BILL-006 invalid invoice period is rejected',()=>{
  const {buildInvoiceNumber}=require('../../BLL/domain/billingRules');
  assert.throws(()=>buildInvoiceNumber({prefix:'PS',ownerId:2,year:2026,month:15,suffix:'A1'}),err=>err.code==='INVALID_INVOICE_CONTEXT');
});

test('QA-PAY-006 full payment using rounded displayed USD settles exact LBP balance',()=>{
  const r=applyPayment({amountDueLbp:1000000,amountDueUsd:11.15,paymentAmountUsd:11.15,usdLbpRate:89700});
  assert.equal(r.status,'paid');
  assert.equal(r.paymentAmountLbp,1000000);
  assert.equal(r.remainingBalanceLbp,0);
  assert.equal(r.remainingBalanceUsd,0);
});

test('QA-PAY-007 USD rounding cannot mark a partial LBP payment as paid',()=>{
  const r=applyPayment({amountDueLbp:1000,amountDueUsd:0.01,paymentAmountLbp:500,usdLbpRate:89700});
  assert.equal(r.status,'partially_paid');
  assert.equal(r.remainingBalanceLbp,500);
});

test('QA-PAY-008 full LBP payment clears the rounded USD remainder too',()=>{
  const r=applyPayment({amountDueLbp:1000000,amountDueUsd:11.15,paymentAmountLbp:1000000,usdLbpRate:89700});
  assert.equal(r.status,'paid');
  assert.equal(r.paymentAmountUsd,11.15);
  assert.equal(r.remainingBalanceUsd,0);
});
