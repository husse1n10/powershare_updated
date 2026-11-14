'use strict';
const test=require('node:test'); const assert=require('node:assert/strict'); const {hasPermission}=require('../../BLL/domain/accessRules');
test('QA-SEC-001 subscriber cannot manage users',()=>assert.equal(hasPermission('subscriber','users:manage'),false));
test('QA-SEC-002 owner can manage billing',()=>assert.equal(hasPermission('owner','billing:manage'),true));
test('QA-SEC-003 collector cannot manage generator settings',()=>assert.equal(hasPermission('collector','generators:manage'),false));
