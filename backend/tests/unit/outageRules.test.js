'use strict';
const test=require('node:test'); const assert=require('node:assert/strict'); const {validateOutage}=require('../../BLL/domain/outageRules');
test('QA-OUT-001 validates one-time outage',()=>assert.equal(validateOutage({schedule_type:'one_time',outage_date:'2026-09-25',start_time:'10:00',end_time:'12:00'}).valid,true));
test('QA-OUT-002 recurring outage requires valid weekday',()=>assert.equal(validateOutage({schedule_type:'recurring',day_of_week:8,start_time:'10:00',end_time:'12:00'}).valid,false));
