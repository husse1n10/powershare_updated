'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,p),'utf8');

const ownerRoutes=read('../../PL/routes/ownerRoutes.js');
const adminRoutes=read('../../PL/routes/adminRoutes.js');
const ownerRepo=read('../../DAL/repositories/billingRepository.js');
const adminRepo=read('../../DAL/repositories/adminRepository.js');
const adminService=read('../../BLL/services/adminService.js');
const reportsUi=read('../../../frontend/src/components/Shared/ReportsPage.js');

test('QA-REPORT-006 report endpoints validate month and year at PL boundary',()=>{
  assert.match(ownerRoutes,/\/reports\/summary'[\s\S]*query\('month'\)\.optional\(\)\.isInt\(\{min:1,max:12\}\)[\s\S]*query\('year'\)\.optional\(\)\.isInt\(\{min:2020,max:2200\}\)/);
  assert.match(adminRoutes,/\/reports\/summary'[\s\S]*query\('month'\)\.optional\(\)\.isInt\(\{min:1,max:12\}\)[\s\S]*query\('year'\)\.optional\(\)\.isInt\(\{min:2020,max:2200\}\)/);
});

test('QA-REPORT-007 owner analytics are tenant and period scoped for collectors and outstanding accounts',()=>{
  assert.match(ownerRepo,/FROM bill_collectors bc[\s\S]*WHERE bc\.owner_id=\?/i);
  assert.match(ownerRepo,/FROM payments WHERE owner_id=\?[\s\S]*MONTH\(paid_at\)=\?[\s\S]*YEAR\(paid_at\)=\?/i);
  assert.match(ownerRepo,/WHERE s\.owner_id=\? AND b\.month=\? AND b\.year=\? AND b\.status IN \('unpaid','partially_paid'\)/i);
  assert.match(ownerRepo,/payment_methods:paymentMethods,collectors,outstanding_accounts:outstandingAccounts/);
});

test('QA-REPORT-008 admin analytics include payment methods support status and synchronized platform fees',()=>{
  assert.match(adminService,/reportSummary\(q=\{\}\)[\s\S]*syncPlatformFees\(p\.month,p\.year\)[\s\S]*admin\.reportSummary/);
  assert.match(adminRepo,/GROUP BY payment_method/i);
  assert.match(adminRepo,/SELECT status,COUNT\(\*\) ticket_count FROM support_tickets GROUP BY status/i);
  assert.match(adminRepo,/FROM platform_fee_collections WHERE month=\? AND year=\?/i);
});

test('QA-REPORT-009 reports UI exposes detailed analytics and CSV export',()=>{
  assert.match(reportsUi,/Export CSV/);
  assert.match(reportsUi,/Billing Status/);
  assert.match(reportsUi,/Payment Methods/);
  assert.match(reportsUi,/Collector Performance/);
  assert.match(reportsUi,/Top Outstanding Accounts/);
  assert.match(reportsUi,/Platform Fee Collection/);
  assert.match(reportsUi,/Support Ticket Status/);
});
