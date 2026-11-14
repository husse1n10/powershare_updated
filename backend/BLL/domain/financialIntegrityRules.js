'use strict';
const AppError=require('../../utils/AppError');

const PAYABLE_STATUSES=new Set(['unpaid','partially_paid']);

function ensureBillPayable(bill){
  if(!bill) throw new AppError('Bill not found',404,'BILL_NOT_FOUND');
  if(!PAYABLE_STATUSES.has(String(bill.status||''))){
    throw new AppError(`Bill with status ${bill.status||'unknown'} cannot receive a payment`,409,'BILL_NOT_PAYABLE');
  }
  const remaining=Math.max(Number(bill.remaining_balance_lbp||0),Number(bill.remaining_balance_usd||0));
  if(remaining<=0) throw new AppError('Bill has no remaining balance',409,'BILL_NOT_PAYABLE');
  return true;
}

function validateCombineCandidates(rows){
  if(!Array.isArray(rows)||rows.length<2) throw new AppError('Select at least 2 bills to combine',422,'COMBINE_INVALID');
  if(rows.some(x=>!PAYABLE_STATUSES.has(String(x.status||'')))) throw new AppError('Only open unpaid bills can be combined',422,'COMBINE_INVALID');
  // DEF-052: combining sums amounts due but each invoice keeps its own payment
  // history, so an already-paid portion would be charged again. Only invoices
  // without payments can be combined.
  if(rows.some(x=>Number(x.amount_received_lbp||0)>0.01||Number(x.amount_received_usd||0)>0.01)){
    throw new AppError('Invoices that already have payments cannot be combined. Collect the remaining balance on each invoice instead.',422,'COMBINE_HAS_PAYMENTS');
  }
  const subscriptionId=Number(rows[0].subscription_id);
  if(!subscriptionId||rows.some(x=>Number(x.subscription_id)!==subscriptionId)) throw new AppError('Selected bills must belong to the same subscriber',422,'COMBINE_INVALID');
  // A bill that already includes a carried previous balance cannot safely be
  // added to another invoice total without counting the same debt twice.
  if(rows.some(x=>Math.abs(Number(x.previous_balance_lbp||0))>0.01 || Math.abs(Number(x.previous_balance_usd||0))>0.01)){
    throw new AppError('Bills that include a previous balance cannot be combined because it would double-count debt',422,'COMBINE_CARRY_FORWARD');
  }
  return true;
}

function outstandingFromBills(bills){
  return (bills||[])
    .filter(b=>PAYABLE_STATUSES.has(String(b.status||'')))
    .reduce((acc,b)=>({
      lbp:acc.lbp+Number(b.remaining_balance_lbp||0),
      usd:acc.usd+Number(b.remaining_balance_usd||0)
    }),{lbp:0,usd:0});
}

module.exports={PAYABLE_STATUSES,ensureBillPayable,validateCombineCandidates,outstandingFromBills};
