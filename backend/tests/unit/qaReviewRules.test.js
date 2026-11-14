'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {assertClientPreviousReading,initialInvoiceStatus}=require('../../BLL/domain/billingRules');
const {validateCombineCandidates}=require('../../BLL/domain/financialIntegrityRules');
const {mergePricingInput,mergeMainMeterInput}=require('../../BLL/domain/masterDataRules');

test('QA-UNIT-REV-001 (DEF-055) client previous reading is only an optimistic check against stored history',()=>{
  assert.equal(assertClientPreviousReading(undefined,1100),true);
  assert.equal(assertClientPreviousReading('',1100),true);
  assert.equal(assertClientPreviousReading('1100',1100),true);
  assert.equal(assertClientPreviousReading(1100.004,1100),true);
  for(const v of [0,1290,'abc',1099.98])assert.throws(()=>assertClientPreviousReading(v,1100),e=>e.code==='PREVIOUS_READING_MISMATCH'&&e.statusCode===409&&e.details.stored_previous_reading===1100);
});

test('QA-UNIT-REV-002 (DEF-059) only invoices with nothing due are settled at creation',()=>{
  assert.equal(initialInvoiceStatus(0,0),'paid');assert.equal(initialInvoiceStatus('0.00','0.00'),'paid');
  assert.equal(initialInvoiceStatus(0.02,0),'unpaid');assert.equal(initialInvoiceStatus(1000000,11.11),'unpaid');
});

test('QA-UNIT-REV-003 (DEF-052) invoices with any payment cannot be combined',()=>{
  const base={status:'unpaid',subscription_id:7,previous_balance_lbp:0,previous_balance_usd:0,amount_received_lbp:0,amount_received_usd:0};
  assert.equal(validateCombineCandidates([{...base},{...base}]),true);
  assert.throws(()=>validateCombineCandidates([{...base},{...base,status:'partially_paid',amount_received_lbp:400000}]),e=>e.code==='COMBINE_HAS_PAYMENTS');
  assert.throws(()=>validateCombineCandidates([{...base},{...base,amount_received_usd:1}]),e=>e.code==='COMBINE_HAS_PAYMENTS');
});

test('QA-UNIT-REV-004 (DEF-060) partial pricing/main-meter updates keep stored values and apply documented defaults',()=>{
  assert.deepEqual(mergePricingInput({plan_id:1,month:6,year:2026,base_cost_below_lbp:12000},null,90000),{plan_id:1,month:6,year:2026,threshold_kwh:100,base_cost_below_lbp:12000,base_cost_above_lbp:12000,maintenance_lbp:0,usd_lbp_rate:90000});
  const stored={threshold_kwh:'150.00',base_cost_below_lbp:'12000.00',base_cost_above_lbp:'15000.00',maintenance_lbp:'0.00',usd_lbp_rate:'89500.00'};
  const merged=mergePricingInput({plan_id:1,month:6,year:2026,maintenance_lbp:5000},stored,90000);
  assert.equal(merged.base_cost_above_lbp,'15000.00');assert.equal(merged.maintenance_lbp,5000);assert.equal(merged.usd_lbp_rate,'89500.00');
  const meter={meter_number:'MM-1',initial_kwh:'5000.00',is_active:1,notes:'n'};
  assert.deepEqual(mergeMainMeterInput({initial_kwh:6000},meter),{meter_number:'MM-1',initial_kwh:6000,is_active:1,notes:'n'});
  assert.equal(mergeMainMeterInput({meter_number:' MM-2 '},meter).initial_kwh,'5000.00');
});
