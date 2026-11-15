'use strict';
const crypto=require('crypto');
const subscriberRepo=require('../../DAL/repositories/subscriberRepository');
const generatorRepo=require('../../DAL/repositories/generatorRepository');
const billingRepo=require('../../DAL/repositories/billingRepository');
const profileRepo=require('../../DAL/repositories/profileRepository');
const adminRepo=require('../../DAL/repositories/adminRepository');
const notifications=require('./notificationService');
const {calculateConsumption,calculateInvoice,applyPayment,buildInvoiceNumber,assertClientPreviousReading,initialInvoiceStatus}=require('../domain/billingRules');
const {isFeatureEnabled}=require('../domain/featureFlagRules');
const {ensureBillPayable}=require('../domain/financialIntegrityRules');
const AppError=require('../../utils/AppError');

function invoiceNumber(owner,year,month){return buildInvoiceNumber({prefix:owner.invoice_prefix||'PS',ownerId:owner.id,year,month,suffix:crypto.randomBytes(3).toString('hex')});}
async function generateForContext(owner,userId,input){
  const sub=await subscriberRepo.getSubscription(owner.id,input.subscription_id); if(!sub)throw new AppError('Subscription not found',404,'SUBSCRIPTION_NOT_FOUND');
  if(await billingRepo.getForPeriod(sub.subscription_id,input.month,input.year))throw new AppError('Bill already exists for this period',409,'BILL_EXISTS');
  // DEF-054: metered invoices require the owner's monthly price for that period.
  // Checked before any reading is written so a rejected request leaves no data behind.
  const monthlyPricing=await generatorRepo.getEffectivePricing(owner.id,sub.plan_id,input.month,input.year);
  if(!monthlyPricing&&!sub.fixed_amount_enabled)throw new AppError(`Monthly pricing for plan "${sub.plan_name}" is not set for ${input.month}/${input.year}. Set the monthly price before generating a metered invoice.`,422,'MONTHLY_PRICING_REQUIRED');
  let meterReadingId=input.meter_reading_id||null; let consumption=0; let createdReadingId=null;
  const suppliedReading=input.current_reading??input.new_meter_reading;
  if(suppliedReading!==undefined&&suppliedReading!==null&&suppliedReading!==''){
    const previous=await subscriberRepo.previousReading(sub.subscription_id,sub.initial_kwh_consumed);
    assertClientPreviousReading(input.previous_reading,previous);
    consumption=calculateConsumption(suppliedReading,previous);
    const reading=await subscriberRepo.createReading({subscription_id:sub.subscription_id,reading_value:Number(suppliedReading),previous_value:previous,reading_date:input.reading_date||`${input.year}-${String(input.month).padStart(2,'0')}-28`,created_by:userId,ocr_confirmed:input.ocr_confirmed===true,ocr_meter_number:input.ocr?.meterNumber||null,ocr_reading_value:input.ocr?.readingValue??null,ocr_confidence:input.ocr?.confidence??null});
    meterReadingId=reading.id;createdReadingId=reading.id;
  }else if(meterReadingId){
    const readings=await subscriberRepo.listReadings(sub.subscription_id);const r=readings.find(x=>Number(x.id)===Number(meterReadingId));if(!r)throw new AppError('Meter reading not found',404,'READING_NOT_FOUND');if(await billingRepo.isReadingBilled(meterReadingId))throw new AppError('This meter reading has already been billed',409,'READING_ALREADY_BILLED');consumption=Number(r.kwh_diff||0);
  }else if(!sub.fixed_amount_enabled){throw new AppError('A meter reading is required for consumption-based billing',422,'READING_REQUIRED');}
  // Fixed-amount subscribers need only an exchange rate; monthly pricing supplies it when present.
  const pricing=monthlyPricing||{threshold_kwh:0,base_cost_below_lbp:0,base_cost_above_lbp:0,maintenance_lbp:0,usd_lbp_rate:owner.usd_lbp_rate};
  const previousBill=await billingRepo.previousBill(sub.subscription_id,input.month,input.year);
  const previousIsOpen=!!previousBill&&['unpaid','partially_paid'].includes(previousBill.status)&&(Number(previousBill.remaining_balance_lbp||0)>0.01||Number(previousBill.remaining_balance_usd||0)>0.01);
  const calc=calculateInvoice({consumption,pricing,fixedAmountEnabled:!!sub.fixed_amount_enabled,fixedAmountUsd:sub.fixed_amount_usd,vatEnabled:!!owner.vat_enabled,vatRate:owner.vat_rate,usdLbpRate:pricing.usd_lbp_rate||owner.usd_lbp_rate,previousBalanceLbp:previousIsOpen?previousBill.remaining_balance_lbp:0,previousBalanceUsd:previousIsOpen?previousBill.remaining_balance_usd:0});
  let bill;
  try{
    bill=await billingRepo.createBill({subscription_id:sub.subscription_id,invoice_number:invoiceNumber(owner,input.year,input.month),month:input.month,year:input.year,meter_reading_id:meterReadingId,kwh_used:consumption,is_fixed_amount:!!sub.fixed_amount_enabled,fixed_amount_usd:sub.fixed_amount_usd,...Object.fromEntries(Object.entries(calc).map(([k,v])=>[({baseAmountLbp:'base_amount_lbp',maintenanceLbp:'maintenance_lbp',totalHtLbp:'total_ht_lbp',vatRate:'vat_rate',vatAmountLbp:'vat_amount_lbp',totalTtcLbp:'total_ttc_lbp',usdLbpRate:'usd_lbp_rate',totalUsd:'total_usd',previousBalanceLbp:'previous_balance_lbp',previousBalanceUsd:'previous_balance_usd',amountDueLbp:'amount_due_lbp',amountDueUsd:'amount_due_usd'}[k]||k),v])),status:initialInvoiceStatus(calc.amountDueLbp,calc.amountDueUsd),created_by:userId,notes:input.notes},{carryFromBillId:previousIsOpen?previousBill.id:null});
  }catch(err){
    if(createdReadingId){
      try{await subscriberRepo.deleteUnbilledReading(sub.subscription_id,createdReadingId);}catch(_cleanupErr){}
    }
    if(err?.code==='ER_DUP_ENTRY'&&/uq_bill_meter_reading/.test(String(err.message)))throw new AppError('This meter reading has already been billed',409,'READING_ALREADY_BILLED');
    if(err?.code==='ER_DUP_ENTRY')throw new AppError('Bill already exists for this period',409,'BILL_EXISTS');
    if(err?.code==='CARRY_FORWARD_CONFLICT')throw new AppError('The previous balance changed while this invoice was being generated. Reload the subscriber and try again.',409,'CARRY_FORWARD_CONFLICT');
    throw err;
  }
  if(bill.subscriber_user_id)await notifications.notifyUser(bill.subscriber_user_id,'bill','New invoice',`Invoice ${bill.invoice_number} has been generated.`,'/subscriber/bills');
  return bill;
}
async function generateForOwner(userId,input){const owner=await profileRepo.getOwnerByUserId(userId);if(!owner)throw new AppError('Owner profile not found',404,'OWNER_NOT_FOUND');return generateForContext(owner,userId,input);}
async function generateForCollector(userId,input){const collector=await profileRepo.getCollectorByUserId(userId);if(!collector)throw new AppError('Collector profile not found',404,'COLLECTOR_NOT_FOUND');const owner=await generatorRepo.getOwnerSettings(collector.owner_id);if(!owner)throw new AppError('Owner profile not found',404,'OWNER_NOT_FOUND');return generateForContext(owner,userId,input);}
async function payBill({bill,userId,ownerId=null,collectorId=null,amountUsd=0,amountLbp=0,paymentMethod='cash',transactionReference=null,notes=null}){
  if(ownerId&&Number(bill.owner_id)!==Number(ownerId))throw new AppError('Bill not found',404,'BILL_NOT_FOUND');
  ensureBillPayable(bill);
  const p=applyPayment({amountDueLbp:bill.amount_due_lbp,amountDueUsd:bill.amount_due_usd,alreadyReceivedLbp:bill.amount_received_lbp,alreadyReceivedUsd:bill.amount_received_usd,paymentAmountUsd:amountUsd,paymentAmountLbp:amountLbp,usdLbpRate:bill.usd_lbp_rate});
  let paymentId;
  try{
    paymentId=await billingRepo.recordPaymentAndUpdateBill({bill,payment:{...p,payment_method:paymentMethod,transaction_reference:transactionReference,notes},collectorId,recordedBy:userId});
  }catch(err){
    if(err?.code==='PAYMENT_CONFLICT')throw new AppError('The bill changed while this payment was being processed. Reload the bill and try again.',409,'PAYMENT_CONFLICT');
    throw err;
  }
  if(bill.subscriber_user_id)await notifications.notifyUser(bill.subscriber_user_id,'payment','Payment recorded',`A payment was recorded for invoice ${bill.invoice_number}.`,'/subscriber/payments');
  return {...p,payment_id:paymentId};
}
async function ownerPay(userId,billId,input={}){const owner=await profileRepo.getOwnerByUserId(userId);if(!owner)throw new AppError('Owner profile not found',404,'OWNER_NOT_FOUND');const bill=await billingRepo.getBillForOwner(owner.id,billId);if(!bill)throw new AppError('Bill not found',404,'BILL_NOT_FOUND');const amountUsd=input.amount_usd??input.amount_received_usd??((input.amount_lbp??input.amount_received_lbp)?0:Number(bill.remaining_balance_usd||bill.amount_due_usd||0));const amountLbp=input.amount_lbp??input.amount_received_lbp??0;return payBill({bill,userId,ownerId:owner.id,amountUsd,amountLbp,paymentMethod:input.payment_method||'cash',transactionReference:input.transaction_reference,notes:input.notes});}
async function collectorPay(userId,billId,input={}){const collector=await profileRepo.getCollectorByUserId(userId);if(!collector)throw new AppError('Collector profile not found',404,'COLLECTOR_NOT_FOUND');const bill=await billingRepo.getBill(billId);if(!bill||Number(bill.owner_id)!==Number(collector.owner_id))throw new AppError('Bill not found',404,'BILL_NOT_FOUND');const amountUsd=input.amount_usd??input.amount_received_usd??((input.amount_lbp??input.amount_received_lbp)?0:Number(bill.remaining_balance_usd||bill.amount_due_usd||0));const amountLbp=input.amount_lbp??input.amount_received_lbp??0;return payBill({bill,userId,ownerId:collector.owner_id,collectorId:collector.id,amountUsd,amountLbp,paymentMethod:'cash',notes:input.notes});}
async function subscriberSimulatedPay(userId,billId,input){const enabled=isFeatureEnabled(await adminRepo.getSettingValue('simulated_online_payment_enabled'),true);if(!enabled)throw new AppError('Simulated online payment is disabled',403,'SIMULATED_PAYMENT_DISABLED');const bill=await billingRepo.getBillBySubscriberUser(userId,billId);if(!bill)throw new AppError('Bill not found',404,'BILL_NOT_FOUND');const full=await billingRepo.getBill(billId);return payBill({bill:full,userId,amountUsd:input.amount_usd||0,amountLbp:input.amount_lbp||0,paymentMethod:'simulated_online',transactionReference:`SIM-${Date.now()}`});}
module.exports={generateForOwner,generateForCollector,ownerPay,collectorPay,subscriberSimulatedPay};
