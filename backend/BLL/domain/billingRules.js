'use strict';
const AppError = require('../../utils/AppError');

function round(value, digits=2){ const f=10**digits; const n=Number(value||0); return Number.isFinite(n)?Math.round(n*f)/f:0; }
function normalizeRate(rate, fallback=89700){ const n=Number(rate); return Number.isFinite(n)&&n>0?n:Number(fallback||89700); }
function validateMeterReading(current, previous){
  const c=Number(current), p=Number(previous??0);
  if(!Number.isFinite(c)||c<0) return {valid:false,error:'Reading value must be a non-negative number'};
  if(!Number.isFinite(p)||p<0) return {valid:false,error:'Previous reading is invalid'};
  if(c<p) return {valid:false,error:`Current reading (${c}) cannot be lower than previous reading (${p})`};
  return {valid:true,consumption:round(c-p,2)};
}
// DEF-055: the previous reading is always taken from stored meter history. A
// value sent by the client is accepted only as an optimistic check that the user
// saw the current history; it can never change the billed consumption.
function assertClientPreviousReading(clientValue,storedPrevious){
  if(clientValue===undefined||clientValue===null||String(clientValue).trim()==='') return true;
  const stored=Number(storedPrevious||0), supplied=Number(clientValue);
  if(!Number.isFinite(supplied)||Math.abs(supplied-stored)>0.01){
    throw new AppError(`Previous reading must match the last recorded reading (${stored}). Reload the meter history and try again.`,409,'PREVIOUS_READING_MISMATCH',{stored_previous_reading:stored});
  }
  return true;
}
// DEF-059: an invoice with nothing to pay is settled at creation instead of
// remaining permanently "unpaid" and unpayable.
function initialInvoiceStatus(amountDueLbp,amountDueUsd=0){ return (Number(amountDueLbp||0)<=0.01&&Number(amountDueUsd||0)<=0.01)?'paid':'unpaid'; }
function calculateConsumption(current,previous){ const v=validateMeterReading(current,previous); if(!v.valid) throw new AppError(v.error,422,'INVALID_METER_READING'); return v.consumption; }
function calculateTieredEnergyCost(consumption, pricing){
  const kwh=Math.max(0,Number(consumption||0));
  const threshold=Math.max(0,Number(pricing?.threshold_kwh||0));
  const below=Math.max(0,Number(pricing?.base_cost_below_lbp||0));
  const above=Math.max(0,Number(pricing?.base_cost_above_lbp||below));
  // Existing generator billing rule: one unit price applies to the full month's usage.
  const unitPrice=kwh<=threshold?below:above;
  return round(kwh*unitPrice,2);
}
function calculateInvoice({
  consumption=0, pricing={}, fixedAmountEnabled=false, fixedAmountUsd=0,
  vatEnabled=true, vatRate=0, usdLbpRate=89700,
  previousBalanceLbp=0, previousBalanceUsd=0,
}){
  const rate=normalizeRate(usdLbpRate);
  let baseAmountLbp=0;
  if(fixedAmountEnabled){ baseAmountLbp=round(Number(fixedAmountUsd||0)*rate,2); }
  else { baseAmountLbp=calculateTieredEnergyCost(consumption,pricing); }
  // Fixed-amount subscriptions are an all-in USD charge: no maintenance and no VAT.
  const maintenanceLbp=fixedAmountEnabled?0:round(Number(pricing?.maintenance_lbp||0),2);
  const totalHtLbp=round(baseAmountLbp+maintenanceLbp,2);
  const safeVat=fixedAmountEnabled?0:(vatEnabled?Math.max(0,Number(vatRate||0)):0);
  const vatAmountLbp=round(totalHtLbp*safeVat/100,2);
  const totalTtcLbp=round(totalHtLbp+vatAmountLbp,2);
  const totalUsd=round(totalTtcLbp/rate,2);
  const carryLbp=round(previousBalanceLbp,2);
  const carryUsd=round(previousBalanceUsd,2);
  return {
    consumption:round(consumption,2), baseAmountLbp, maintenanceLbp, totalHtLbp,
    vatRate:safeVat, vatAmountLbp, totalTtcLbp, usdLbpRate:rate, totalUsd,
    previousBalanceLbp:carryLbp, previousBalanceUsd:carryUsd,
    amountDueLbp:round(totalTtcLbp+carryLbp,2),
    amountDueUsd:round(totalUsd+carryUsd,2),
    amountReceivedLbp:0, amountReceivedUsd:0,
    remainingBalanceLbp:round(totalTtcLbp+carryLbp,2),
    remainingBalanceUsd:round(totalUsd+carryUsd,2),
  };
}

function normalizeInvoicePrefix(value){
  const cleaned=String(value||'PS').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,20);
  return cleaned||'PS';
}
function buildInvoiceNumber({prefix='PS',ownerId,year,month,suffix}){
  const p=normalizeInvoicePrefix(prefix);
  const y=Number(year),m=Number(month),o=Number(ownerId);
  if(!Number.isInteger(y)||y<2020||!Number.isInteger(m)||m<1||m>12||!Number.isInteger(o)||o<1) throw new AppError('Invalid invoice numbering context',422,'INVALID_INVOICE_CONTEXT');
  const tail=String(suffix||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12);
  if(!tail) throw new AppError('Invoice suffix is required',422,'INVALID_INVOICE_SUFFIX');
  return `${p}-${o}-${y}${String(m).padStart(2,'0')}-${tail}`;
}

function applyPayment({amountDueLbp,amountDueUsd,alreadyReceivedLbp=0,alreadyReceivedUsd=0,paymentAmountUsd=0,paymentAmountLbp=0,usdLbpRate=89700}){
  const rate=normalizeRate(usdLbpRate);
  let payUsd=Number(paymentAmountUsd||0), payLbp=Number(paymentAmountLbp||0);
  if(payUsd<0||payLbp<0||(!payUsd&&!payLbp)) throw new AppError('Payment amount must be greater than zero',422,'INVALID_PAYMENT');

  const dueLbp=Math.max(0,round(Number(amountDueLbp||0),2));
  const dueUsd=Math.max(0,round(Number(amountDueUsd||0),2));
  const receivedLbp=Math.max(0,round(Number(alreadyReceivedLbp||0),2));
  const receivedUsd=Math.max(0,round(Number(alreadyReceivedUsd||0),2));
  const outstandingLbp=Math.max(0,round(dueLbp-receivedLbp,2));
  const outstandingUsd=Math.max(0,round(dueUsd-receivedUsd,2));
  if(outstandingLbp<=0.01) throw new AppError('Bill is already fully paid',409,'BILL_ALREADY_PAID');

  // LBP is the canonical accounting amount. USD totals are rounded to cents on
  // invoices, so converting a displayed full USD balance back to LBP can be a
  // few hundred LBP above/below the exact bill. A payment that matches the
  // displayed remaining USD amount therefore settles the exact LBP remainder.
  if(payLbp>0){
    if(payLbp>outstandingLbp+0.01) throw new AppError('Payment cannot exceed the remaining balance',422,'PAYMENT_EXCEEDS_BALANCE');
    if(Math.abs(payLbp-outstandingLbp)<=0.01){
      payLbp=outstandingLbp;
      payUsd=outstandingUsd;
    }else{
      payUsd=round(payLbp/rate,2);
    }
  }else{
    if(payUsd>outstandingUsd+0.01) throw new AppError('Payment cannot exceed the remaining balance',422,'PAYMENT_EXCEEDS_BALANCE');
    if(Math.abs(payUsd-outstandingUsd)<=0.01){
      payUsd=outstandingUsd;
      payLbp=outstandingLbp;
    }else{
      payLbp=round(payUsd*rate,2);
      if(payLbp>outstandingLbp+0.01) throw new AppError('Payment cannot exceed the remaining balance',422,'PAYMENT_EXCEEDS_BALANCE');
    }
  }

  const recvLbp=round(receivedLbp+payLbp,2);
  const remLbp=Math.max(0,round(dueLbp-recvLbp,2));
  const status=remLbp<=0.01?'paid':'partially_paid';
  const remUsd=status==='paid'?0:round(remLbp/rate,2);
  const recvUsd=status==='paid'?dueUsd:Math.max(0,round(dueUsd-remUsd,2));
  return { paymentAmountLbp:round(payLbp,2), paymentAmountUsd:round(payUsd,2), amountReceivedLbp:recvLbp, amountReceivedUsd:recvUsd, remainingBalanceLbp:remLbp, remainingBalanceUsd:remUsd, status };
}
module.exports={round,normalizeRate,validateMeterReading,assertClientPreviousReading,initialInvoiceStatus,calculateConsumption,calculateTieredEnergyCost,calculateInvoice,normalizeInvoicePrefix,buildInvoiceNumber,applyPayment};
