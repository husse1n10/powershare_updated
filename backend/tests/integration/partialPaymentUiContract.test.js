'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const file=fs.readFileSync(path.join(__dirname,'..','..','..','frontend','src','components','Owner','OwnerBills.js'),'utf8');

test('QA-PAYMENT-UI-002 partially paid invoices remain actionable and use remaining balance',()=>{
  assert.match(file,/function isOpenBill\(bill\)/);
  assert.match(file,/\['unpaid', 'partially_paid'\]/);
  assert.match(file,/resolveBillRemainingUsd\(bill, fallbackUsdRate\)\.toFixed\(2\)/);
  assert.match(file,/isOpenBill\(b\).*openPaymentModal/s);
});

test('QA-BALANCE-003 owner bill UI exposes outstanding-balance reminder action',()=>{
  assert.match(file,/handleBalanceReminder/);
  assert.match(file,/\/owner\/bills\/\$\{billId\}\/remind/);
  assert.match(file,/Send balance reminder/);
});
