'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseCombinedItems,prepareInvoiceBill}=require('../../BLL/domain/invoiceView');

test('QA-INVOICE-PRINT-001 combined invoice metadata is exposed as printable line items',()=>{
  const items=[{bill_id:1,month:7,year:2026,kwh_used:120},{bill_id:2,month:8,year:2026,kwh_used:130}];
  const bill=prepareInvoiceBill({id:9,combined_meta_json:JSON.stringify({version:2,items})});
  assert.deepEqual(bill.combined_items,items);
});

test('QA-INVOICE-PRINT-002 malformed combined invoice metadata never breaks invoice viewing',()=>{
  assert.deepEqual(parseCombinedItems('{bad json'),[]);
  assert.deepEqual(prepareInvoiceBill({id:1,combined_meta_json:null}).combined_items,[]);
});
