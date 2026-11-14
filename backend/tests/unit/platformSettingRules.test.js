'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizePlatformSetting}=require('../../BLL/domain/platformSettingRules');

test('QA-SETTINGS-002 normalizes supported platform settings',()=>{
  assert.equal(normalizePlatformSetting('platform_name','  PowerShare Lebanon  '),'PowerShare Lebanon');
  assert.equal(normalizePlatformSetting('platform_fee_per_subscriber','0.12555'),'0.1256');
  assert.equal(normalizePlatformSetting('default_usd_lbp_rate','89700'),'89700');
  assert.equal(normalizePlatformSetting('simulated_online_payment_enabled','yes'),'1');
  assert.equal(normalizePlatformSetting('simulated_online_payment_enabled','off'),'0');
  assert.equal(normalizePlatformSetting('support_email','support@example.com'),'support@example.com');
});

test('QA-SETTINGS-003 rejects unknown or malformed platform settings',()=>{
  assert.throws(()=>normalizePlatformSetting('unknown_key','1'),e=>e?.code==='INVALID_PLATFORM_SETTING');
  assert.throws(()=>normalizePlatformSetting('platform_fee_per_subscriber','-1'),e=>e?.code==='INVALID_PLATFORM_SETTING');
  assert.throws(()=>normalizePlatformSetting('default_usd_lbp_rate','0'),e=>e?.code==='INVALID_PLATFORM_SETTING');
  assert.throws(()=>normalizePlatformSetting('simulated_online_payment_enabled','maybe'),e=>e?.code==='INVALID_PLATFORM_SETTING');
  assert.throws(()=>normalizePlatformSetting('support_email','not-an-email'),e=>e?.code==='INVALID_PLATFORM_SETTING');
});
