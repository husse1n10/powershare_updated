'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const smoke=fs.readFileSync(path.resolve(__dirname,'../../scripts/smoke-db.js'),'utf8');

test('QA-DB-005 live DB smoke includes payment-to-bill reconciliation',()=>{
  assert.match(smoke,/SUM\(p\.amount_lbp\)/);
  assert.match(smoke,/amount_received_lbp/);
});
test('QA-DB-006 live DB smoke validates carry-forward lineage',()=>{
  assert.match(smoke,/carried_forward_to_bill_id/);
  assert.match(smoke,/previous balance without source lineage/i);
});
test('QA-DB-007 live DB smoke validates collector payment and settlement ledger links',()=>{
  assert.match(smoke,/collector payment\(s\) have no ledger entry/i);
  assert.match(smoke,/confirmed settlement\(s\) have no ledger entry/i);
});
