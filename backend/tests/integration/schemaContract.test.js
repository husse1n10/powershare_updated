'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const schema=fs.readFileSync(path.resolve(__dirname,'../../database/schema.sql'),'utf8');

const tables=[
  'users','generator_owners','bill_collectors','owner_main_meters','generators','plans',
  'plan_monthly_pricing','subscriber_profiles','subscriptions','collector_generator_assignments',
  'collector_subscriber_assignments','meter_readings','bills','payments','collector_settlements',
  'collector_ledger','outage_schedules','notifications','support_tickets','support_ticket_responses',
  'platform_settings','platform_fee_collections','audit_logs','refresh_tokens'
];

test('QA-DB-001 proposal entities exist in SQL schema',()=>{
  for(const table of tables){assert.match(schema,new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${table}\\s*\\(`,'i'),`Missing table: ${table}`);}
});

test('QA-DB-002 owner invoice/company settings required by UI are persisted',()=>{
  const columns=['company_name','company_street','company_city','capital_lbp','fiscal_number','registry_number','invoice_title','invoice_meter_label'];
  for(const column of columns)assert.match(schema,new RegExp(`\\b${column}\\b`,'i'),`Missing owner setting column: ${column}`);
});

test('QA-DB-003 financial records preserve historical exchange rate and balances',()=>{
  for(const column of ['usd_lbp_rate','previous_balance_lbp','amount_due_lbp','amount_received_lbp','remaining_balance_lbp']) assert.match(schema,new RegExp(`\\b${column}\\b`,'i'));
});

test('QA-DB-004 audit and refresh token persistence exist',()=>{
  assert.match(schema,/CREATE TABLE IF NOT EXISTS\s+audit_logs/i);
  assert.match(schema,/CREATE TABLE IF NOT EXISTS\s+refresh_tokens/i);
});
