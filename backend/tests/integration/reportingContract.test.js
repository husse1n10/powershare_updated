'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,p),'utf8');
const ownerCtrl=read('../../PL/controllers/ownerController.js');
const adminCtrl=read('../../PL/controllers/adminController.js');
const billingRepo=read('../../DAL/repositories/billingRepository.js');
const adminRepo=read('../../DAL/repositories/adminRepository.js');
const reportsUi=read('../../../frontend/src/components/Shared/ReportsPage.js');

test('QA-REPORT-002 report endpoints accept a month/year period',()=>{
  assert.match(ownerCtrl,/service\.report\(req\.user\.id,req\.query\)/);
  assert.match(adminCtrl,/service\.reportSummary\(req\.query\)/);
  assert.match(reportsUi,/params:period/);
});

test('QA-REPORT-003 report billed revenue uses current-period charges, not rolled previous debt',()=>{
  // DEF-058: merged invoices are excluded because their amounts live in the combined invoice.
  assert.match(billingRepo,/SUM\(CASE WHEN b\.combined_parent_bill_id IS NULL THEN b\.total_ttc_lbp ELSE 0 END\)/i);
  assert.match(adminRepo,/SUM\(CASE WHEN combined_parent_bill_id IS NULL THEN total_ttc_lbp ELSE 0 END\)/i);
});

test('QA-REPORT-004 outstanding report includes only currently payable bills',()=>{
  assert.match(billingRepo,/status IN \('unpaid','partially_paid'\)[\s\S]*remaining_balance_lbp/i);
  assert.match(adminRepo,/status IN \('unpaid','partially_paid'\)[\s\S]*remaining_balance_lbp/i);
});
