'use strict';
const test=require('node:test'); const assert=require('node:assert/strict');
const {calculateCollectorBalance,validateSettlement}=require('../../BLL/domain/collectorRules');
test('QA-COL-001 ledger balance = collections minus confirmed settlements',()=>{ assert.equal(calculateCollectorBalance([{tx_type:'bill_collection',amount_lbp:1000000},{tx_type:'bill_collection',amount_lbp:500000},{tx_type:'owner_settlement',amount_lbp:900000}]),600000); });
test('QA-COL-002 rejects settlement above collector balance',()=>{ assert.throws(()=>validateSettlement(700000,600000),/exceeds/i); });
