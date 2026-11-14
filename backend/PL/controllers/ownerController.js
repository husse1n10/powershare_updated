'use strict';
const service=require('../../BLL/services/ownerService');
const registration=require('../../BLL/services/registrationService');
async function listRegistrationApplications(req,res){res.json(await registration.listApplications(req.query.status||'pending',req.user.id));}
async function registrationApplication(req,res){res.json(await registration.detail(Number(req.params.id),req.user.id));}
async function assignSubscriberMeter(req,res){res.json(await registration.assign(Number(req.params.id),req.body,req));}
function ok(res,data){res.json(data);}
async function dashboard(req,res){ok(res,await service.dashboard(req.user.id));}
async function listGenerators(req,res){ok(res,await service.listGenerators(req.user.id));}
async function createGenerator(req,res){res.status(201).json(await service.createGenerator(req.user.id,req.body,req));}
async function updateGenerator(req,res){ok(res,await service.updateGenerator(req.user.id,req.params.id,req.body,req));}
async function deleteGenerator(req,res){await service.deleteGenerator(req.user.id,req.params.id,req);ok(res,{message:'Generator deactivated'});}
async function listMainMeters(req,res){ok(res,await service.listMainMeters(req.user.id));}
async function createMainMeter(req,res){res.status(201).json(await service.createMainMeter(req.user.id,req.body,req));}
async function updateMainMeter(req,res){ok(res,await service.updateMainMeter(req.user.id,req.params.id,req.body,req));}
async function deleteMainMeter(req,res){await service.deleteMainMeter(req.user.id,req.params.id,req);ok(res,{message:'Main meter deactivated'});}
async function listPlans(req,res){ok(res,await service.listPlans(req.user.id));}
async function createPlan(req,res){res.status(201).json(await service.createPlan(req.user.id,req.body,req));}
async function updatePlan(req,res){ok(res,await service.updatePlan(req.user.id,req.params.id,req.body,req));}
async function deletePlan(req,res){await service.deletePlan(req.user.id,req.params.id,req);ok(res,{message:'Plan deactivated'});}
async function pricing(req,res){ok(res,await service.listPricing(req.user.id,req.query));}
async function savePricing(req,res){ok(res,await service.savePricing(req.user.id,req.body,req));}
async function deletePricing(req,res){await service.deletePricing(req.user.id,req.params.plan_id,req.query.month,req.query.year,req);ok(res,{message:'Pricing removed'});}
async function subscribers(req,res){ok(res,await service.listSubscribers(req.user.id));}
async function createSubscriber(req,res){res.status(201).json(await service.createSubscriber(req.user.id,req.body,req));}
async function updateSubscriber(req,res){ok(res,await service.updateSubscriber(req.user.id,req.params.id,req.body,req));}
async function endSubscription(req,res){await service.deactivateSubscription(req.user.id,req.params.id,req);ok(res,{message:'Subscription ended'});}
async function deleteSubscriber(req,res){await service.deleteSubscriber(req.user.id,req.params.id,req);ok(res,{message:'Subscriber deleted'});}
async function resubscribe(req,res){await service.resubscribe(req.user.id,req.params.id,req.body.plan_id,req);ok(res,{message:'Subscription reactivated'});}
async function createSubscriberAccount(req,res){res.status(201).json(await service.createSubscriberAccount(req.user.id,req.params.id,req.body,req));}
async function collectors(req,res){ok(res,await service.listCollectors(req.user.id));}
async function createCollector(req,res){res.status(201).json(await service.createCollector(req.user.id,req.body,req));}
async function updateCollector(req,res){await service.updateCollector(req.user.id,req.params.id,req.body,req);ok(res,{message:'Collector updated'});}
async function deleteCollector(req,res){await service.updateCollector(req.user.id,req.params.id,{is_active:0},req);ok(res,{message:'Collector deactivated'});}
async function assignments(req,res){await service.setCollectorAssignments(req.user.id,req.params.id,req.body,req);ok(res,{message:'Assignments updated'});}
async function settlements(req,res){ok(res,await service.listSettlements(req.user.id));}
async function confirmSettlement(req,res){ok(res,await service.confirmSettlement(req.user.id,req.params.id,req.body,req));}
async function rejectSettlement(req,res){ok(res,await service.rejectSettlement(req.user.id,req.params.id,req.body,req));}
async function readings(req,res){ok(res,await service.listReadings(req.user.id,req.params.subscription_id));}
async function addReading(req,res){const d={...req.body,photo_path:req.file?.path};ok(res,await service.addReading(req.user.id,d,req));}
async function scan(req,res){ok(res,await service.scanMeter(req.user.id,req.file?.path));}
async function deleteBill(req,res){await service.deleteBill(req.user.id,req.params.id,req);ok(res,{message:'Bill deleted'});}
async function combineBills(req,res){ok(res,await service.combineBills(req.user.id,req.body.bill_ids,req));}
async function bills(req,res){ok(res,await service.listBills(req.user.id,req.query));}
async function getBill(req,res){ok(res,await service.getBill(req.user.id,req.params.id));}
async function generateBill(req,res){res.status(201).json(await service.generateBill(req.user.id,req.body,req));}
async function payBill(req,res){ok(res,await service.payBill(req.user.id,req.params.id,req.body,req));}
async function remindBalance(req,res){ok(res,await service.sendBalanceReminder(req.user.id,req.params.id,req));}
async function payments(req,res){ok(res,await service.listPayments(req.user.id));}
async function outages(req,res){ok(res,await service.listOutages(req.user.id,req.params.generator_id));}
async function createOutage(req,res){res.status(201).json(await service.createOutage(req.user.id,req.body,req));}
async function updateOutage(req,res){ok(res,await service.updateOutage(req.user.id,req.params.id,req.body,req));}
async function deleteOutage(req,res){await service.deleteOutage(req.user.id,req.params.id,req);ok(res,{message:'Outage deactivated'});}
async function settings(req,res){ok(res,await service.getSettings(req.user.id));}
async function updateSettings(req,res){ok(res,await service.updateSettings(req.user.id,req.body,req));}
async function report(req,res){ok(res,await service.report(req.user.id,req.query));}
module.exports={listRegistrationApplications,registrationApplication,assignSubscriberMeter,dashboard,deleteSubscriber,deleteBill,combineBills,listGenerators,createGenerator,updateGenerator,deleteGenerator,listMainMeters,createMainMeter,updateMainMeter,deleteMainMeter,listPlans,createPlan,updatePlan,deletePlan,pricing,savePricing,deletePricing,subscribers,createSubscriber,updateSubscriber,endSubscription,resubscribe,createSubscriberAccount,collectors,createCollector,updateCollector,deleteCollector,assignments,settlements,confirmSettlement,rejectSettlement,readings,addReading,scan,bills,getBill,generateBill,payBill,remindBalance,payments,outages,createOutage,updateOutage,deleteOutage,settings,updateSettings,report};
