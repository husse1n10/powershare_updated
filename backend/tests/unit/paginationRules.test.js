'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeLimit}=require('../../BLL/domain/paginationRules');

test('QA-NOTIFY-005 notification pagination defaults invalid values safely',()=>{
  assert.equal(normalizeLimit(undefined),50);
  assert.equal(normalizeLimit('abc'),50);
});

test('QA-NOTIFY-006 notification pagination clamps the result to 1..100',()=>{
  assert.equal(normalizeLimit(0),1);
  assert.equal(normalizeLimit(-50),1);
  assert.equal(normalizeLimit(25),25);
  assert.equal(normalizeLimit(1000),100);
});
