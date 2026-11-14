'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('QA-INVOICE-PRINT-003 invoice DAL includes subscriber address meter generator and reading fields for printing',()=>{
  const repo=read('DAL/repositories/billingRepository.js');
  for(const field of ['subscriber_phone','subscriber_address','generator_location','prev_reading','current_reading','initial_kwh_consumed']) assert.match(repo,new RegExp(field));
  assert.match(repo,/LEFT JOIN meter_readings mr ON mr\.id=b\.meter_reading_id/i);
});

test('QA-PORTAL-INVOICE-001 subscriber bill detail returns invoice plus owner settings within subscriber ownership',()=>{
  const service=read('BLL/services/subscriberService.js');
  const repo=read('DAL/repositories/billingRepository.js');
  assert.match(service,/getBillBySubscriberUser\(userId,id\)/);
  assert.match(service,/getOwnerSettings\(b\.owner_id\)/);
  assert.match(service,/prepareInvoiceBill\(b\)/);
  assert.match(repo,/WHERE sp\.user_id=\? AND b\.id=\?/i);
});

test('QA-PORTAL-INVOICE-002 subscriber portal exposes detailed printable invoices',()=>{
  const ui=read('../frontend/src/components/Subscriber/SubscriberBills.js');
  assert.match(ui,/api\.get\(`\/subscriber\/bills\/\$\{billId\}`\)/);
  assert.match(ui,/InvoicePrint/);
  assert.match(ui,/t\.viewInvoice/);
});

test('QA-PORTAL-I18N-001 subscriber dashboard billing consumption payment outage and profile pages use shared translations',()=>{
  const files=['SubscriberDashboard.js','SubscriberBills.js','SubscriberConsumption.js','SubscriberPayments.js','SubscriberOutages.js','SubscriberSettings.js'];
  for(const file of files){const src=read(`../frontend/src/components/Subscriber/${file}`);assert.match(src,/useLang/);}
  const i18n=read('../frontend/src/i18n.js');
  for(const key of ['subscriberDashboard','consumptionHistory','paymentHistory','outageSchedule','simulatePayment','viewInvoice','profileSecurity']) assert.match(i18n,new RegExp(`${key}:`));
});
