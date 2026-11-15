'use strict';
const subscriberRepo=require('../../DAL/repositories/subscriberRepository');
const billingRepo=require('../../DAL/repositories/billingRepository');
const outageRepo=require('../../DAL/repositories/outageRepository');
const generatorRepo=require('../../DAL/repositories/generatorRepository');
const billingService=require('./billingService');
const audit=require('./auditService');
const registration=require('../../DAL/repositories/registrationRepository');
const AppError=require('../../utils/AppError');
const {outstandingFromBills}=require('../domain/financialIntegrityRules');
const {prepareInvoiceBill}=require('../domain/invoiceView');
async function subscription(userId){const s=await subscriberRepo.getByUserId(userId);if(!s){const application=await registration.getByUserId(userId);if(['unselected','pending'].includes(application?.status))return {registration_status:application.status,registration_application:application};throw new AppError('Subscriber profile or active subscription not found',404,'SUBSCRIBER_NOT_FOUND');}return s;}
async function dashboard(userId){const s=await subscription(userId);if(['unselected','pending'].includes(s.registration_status))return {registration_application:s.registration_application,subscription:null,current_bill:null,outstanding_lbp:0,outstanding_usd:0,recent_consumption:[],recent_payments:[],upcoming_outages:[]};const [bills,payments,consumption,outages]=await Promise.all([billingRepo.listBillsBySubscriberUser(userId),billingRepo.listPaymentsBySubscriberUser(userId),subscriberRepo.listConsumptionByUser(userId),outageRepo.listForSubscriberUser(userId)]);const current=bills.find(b=>['unpaid','partially_paid'].includes(b.status))||bills[0]||null;const outstanding=outstandingFromBills(bills);return {subscription:s,current_bill:current,outstanding_lbp:outstanding.lbp,outstanding_usd:outstanding.usd,recent_consumption:consumption.slice(0,6),recent_payments:payments.slice(0,6),upcoming_outages:outages.slice(0,6)};}
async function bill(userId,id){const b=await billingRepo.getBillBySubscriberUser(userId,id);if(!b)throw new AppError('Bill not found',404,'BILL_NOT_FOUND');const owner=await generatorRepo.getOwnerSettings(b.owner_id);return {bill:prepareInvoiceBill(b),owner};}
async function simulatedPay(userId,id,data,req){const result=await billingService.subscriberSimulatedPay(userId,id,data);await audit.logFromRequest(req,'SIMULATED_PAYMENT_RECORDED','bill',id,{amount_lbp:result.paymentAmountLbp,amount_usd:result.paymentAmountUsd});return result;}
module.exports={dashboard,subscription,consumption:subscriberRepo.listConsumptionByUser,bills:billingRepo.listBillsBySubscriberUser,bill,payments:billingRepo.listPaymentsBySubscriberUser,outages:outageRepo.listForSubscriberUser,simulatedPay};
