'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const schema=fs.readFileSync(path.resolve(__dirname,'../../database/schema.sql'),'utf8');
const billingRepo=fs.readFileSync(path.resolve(__dirname,'../../DAL/repositories/billingRepository.js'),'utf8');
const collectorRepo=fs.readFileSync(path.resolve(__dirname,'../../DAL/repositories/collectorRepository.js'),'utf8');
const billingService=fs.readFileSync(path.resolve(__dirname,'../../BLL/services/billingService.js'),'utf8');

test('QA-FIN-006 schema records balance carry-forward lineage',()=>{
  assert.match(schema,/carried_forward_to_bill_id/i);
  assert.match(schema,/carried_forward/i);
});

test('QA-FIN-007 payment update uses optimistic concurrency guard',()=>{
  assert.match(billingRepo,/amount_received_lbp=\?\s+AND amount_received_usd=\?/i);
  assert.match(billingRepo,/PAYMENT_CONFLICT/);
  assert.match(billingService,/PAYMENT_CONFLICT/);
});

test('QA-FIN-008 collector payment and collector ledger entry share one transaction',()=>{
  const fn=billingRepo.match(/async function recordPaymentAndUpdateBill[\s\S]*?\n}\nasync function listPaymentsByOwner/);
  assert.ok(fn,'recordPaymentAndUpdateBill not found');
  assert.match(fn[0],/INSERT INTO payments/);
  assert.match(fn[0],/INSERT INTO collector_ledger/);
  assert.match(fn[0],/transaction\(async conn/);
});

test('QA-FIN-009 settlement confirmation locks collector before balance check',()=>{
  assert.match(collectorRepo,/bill_collectors[\s\S]*FOR UPDATE/i);
  assert.match(collectorRepo,/SETTLEMENT_CONFLICT/);
});

test('QA-FIN-010 generating a new bill can roll an open balance forward atomically',()=>{
  assert.match(billingRepo,/status='carried_forward',carried_forward_to_bill_id=\?/);
  assert.match(billingService,/carryFromBillId:previousIsOpen\?previousBill\.id:null/);
});

test('QA-FIN-011 carry-forward requires a guarded previous-bill update',()=>{
  assert.match(billingRepo,/carryResult\.affectedRows\s*!==\s*1/);
  assert.match(billingRepo,/CARRY_FORWARD_CONFLICT/);
});

test('QA-FIN-012 failed bill generation cleans up a newly created unbilled meter reading',()=>{
  const subRepo=fs.readFileSync(path.resolve(__dirname,'../../DAL/repositories/subscriberRepository.js'),'utf8');
  assert.match(billingService,/deleteUnbilledReading/);
  assert.match(subRepo,/NOT EXISTS \(SELECT 1 FROM bills WHERE meter_reading_id=\?\)/);
});

test('QA-FIN-013 settlement request locks collector and accounts for already-pending requests',()=>{
  const repo=collectorRepo;
  assert.match(repo,/bill_collectors[^`]*FOR UPDATE/s);
  assert.match(repo,/status='pending'/);
  assert.match(repo,/SETTLEMENT_REQUEST_CONFLICT/);
  assert.match(repo,/available=Math\.max\(0,balance-pending\)/);
});


test('QA-FIN-014 settlement rejection succeeds only for a pending row',()=>{
  assert.match(collectorRepo,/status='pending'/);
  assert.match(collectorRepo,/affectedRows!==1\)return null/);
});
