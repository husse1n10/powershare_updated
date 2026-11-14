'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {isFeatureEnabled}=require('../../BLL/domain/featureFlagRules');

test('QA-PAY-004 simulated payment feature flag accepts enabled values',()=>{
  assert.equal(isFeatureEnabled('1'),true);
  assert.equal(isFeatureEnabled('true'),true);
  assert.equal(isFeatureEnabled('enabled'),true);
});

test('QA-PAY-005 simulated payment feature flag rejects disabled values',()=>{
  assert.equal(isFeatureEnabled('0',true),false);
  assert.equal(isFeatureEnabled('false',true),false);
  assert.equal(isFeatureEnabled('disabled',true),false);
});
