'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validateGenerator,validateMainMeter,validatePlan,validatePricing,validateSubscriber,validateOwnerSettings}=require('../../BLL/domain/masterDataRules');

test('QA-VALID-001 rejects negative generator capacity',()=>{
  assert.equal(validateGenerator({name:'G1',location_name:'Rmeich',total_kw:-1}).valid,false);
});
test('QA-VALID-002 accepts generator maintenance status and positive capacity',()=>{
  assert.equal(validateGenerator({name:'G1',location_name:'Rmeich',total_kw:250,status:'maintenance'}).valid,true);
});
test('QA-VALID-003 rejects a negative main meter reading',()=>{
  assert.equal(validateMainMeter({meter_number:'M-1',initial_kwh:-1}).valid,false);
});
test('QA-VALID-004 rejects zero ampere plans',()=>{
  assert.equal(validatePlan({name:'10A',ampere:0}).valid,false);
});
test('QA-VALID-005 rejects negative plan charges',()=>{
  assert.equal(validatePlan({name:'10A',ampere:10,maintenance_lbp:-100}).valid,false);
});
test('QA-VALID-006 rejects invalid monthly pricing exchange rate',()=>{
  assert.equal(validatePricing({month:9,year:2026,usd_lbp_rate:0}).valid,false);
});
test('QA-VALID-007 validates complete monthly pricing',()=>{
  assert.equal(validatePricing({month:9,year:2026,threshold_kwh:100,base_cost_below_lbp:10000,base_cost_above_lbp:12000,maintenance_lbp:500000,usd_lbp_rate:89500}).valid,true);
});
test('QA-VALID-008 fixed subscriber requires a positive fixed amount',()=>{
  assert.equal(validateSubscriber({full_name:'Test',location_address:'Rmeich',fixed_amount_enabled:true,fixed_amount_usd:0}).valid,false);
});
test('QA-VALID-009 subscriber rejects negative initial reading',()=>{
  assert.equal(validateSubscriber({full_name:'Test',location_address:'Rmeich',initial_kwh_consumed:-5}).valid,false);
});
test('QA-VALID-010 owner settings reject zero exchange rate',()=>{
  assert.equal(validateOwnerSettings({usd_lbp_rate:0}).valid,false);
});
test('QA-VALID-011 owner settings reject VAT over 100 percent',()=>{
  assert.equal(validateOwnerSettings({vat_rate:101}).valid,false);
});
test('QA-VALID-012 partial subscriber update validates only supplied fields',()=>{
  assert.equal(validateSubscriber({phone:'03123456'},true).valid,true);
});
