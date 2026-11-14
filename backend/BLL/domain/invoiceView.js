'use strict';

function parseCombinedItems(raw){
  if(!raw)return [];
  try{
    const parsed=typeof raw==='string'?JSON.parse(raw):raw;
    return Array.isArray(parsed?.items)?parsed.items:[];
  }catch(_){return [];}
}

function prepareInvoiceBill(bill){
  if(!bill)return bill;
  return {...bill,combined_items:parseCombinedItems(bill.combined_meta_json)};
}

module.exports={parseCombinedItems,prepareInvoiceBill};
