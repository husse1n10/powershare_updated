'use strict';
const service=require('../../BLL/services/subscriberService');
async function dashboard(req,res){res.json(await service.dashboard(req.user.id));}
async function subscription(req,res){res.json(await service.subscription(req.user.id));}
async function consumption(req,res){res.json(await service.consumption(req.user.id));}
async function bills(req,res){res.json(await service.bills(req.user.id));}
async function bill(req,res){res.json(await service.bill(req.user.id,req.params.id));}
async function payments(req,res){res.json(await service.payments(req.user.id));}
async function outages(req,res){res.json(await service.outages(req.user.id));}
async function simulatePayment(req,res){res.json(await service.simulatedPay(req.user.id,req.params.id,req.body,req));}
module.exports={dashboard,subscription,consumption,bills,bill,payments,outages,simulatePayment};
