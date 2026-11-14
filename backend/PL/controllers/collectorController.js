'use strict';
const service=require('../../BLL/services/collectorService');
async function dashboard(req,res){res.json(await service.dashboard(req.user.id));}
async function subscribers(req,res){res.json(await service.listSubscribers(req.user.id));}
async function combineBills(req,res){res.json(await service.combineBills(req.user.id,req.body.bill_ids,req));}
async function generateBill(req,res){res.status(201).json(await service.generateBill(req.user.id,req.body,req));}
async function bills(req,res){res.json(await service.listBills(req.user.id,req.query));}
async function bill(req,res){res.json(await service.getBill(req.user.id,req.params.id));}
async function pay(req,res){res.json(await service.pay(req.user.id,req.params.id,req.body,req));}
async function readings(req,res){res.json(await service.listReadings(req.user.id,req.params.subscription_id));}
async function addReading(req,res){res.json(await service.addReading(req.user.id,{...req.body,photo_path:req.file?.path},req));}
async function scan(req,res){res.json(await service.scan(req.user.id,req.file?.path));}
async function wallet(req,res){res.json(await service.wallet(req.user.id));}
async function settlements(req,res){res.json(await service.settlements(req.user.id));}
async function requestSettlement(req,res){res.status(201).json(await service.requestSettlement(req.user.id,req.body,req));}
module.exports={dashboard,combineBills,subscribers,bills,generateBill,bill,pay,readings,addReading,scan,wallet,settlements,requestSettlement};
