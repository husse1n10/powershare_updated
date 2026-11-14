'use strict';
const service=require('../../BLL/services/adminService');
const registration=require('../../BLL/services/registrationService');
async function listRegistrationApplications(req,res){res.json(await registration.listApplications(req.query.status||'pending'));}
async function registrationApplication(req,res){res.json(await registration.detail(Number(req.params.id)));}
async function assignSubscriberMeter(req,res){res.json(await registration.assign(Number(req.params.id),req.body,req));}
async function dashboard(req,res){res.json(await service.dashboard(req.query));}
async function listUsers(req,res){res.json(await service.listUsers(req.query));}
async function createUser(req,res){res.status(201).json(await service.createUser(req.body,req));}
async function updateUser(req,res){res.json(await service.updateUser(Number(req.params.id),req.body,req));}
async function deleteUser(req,res){res.json(await service.deactivateUser(Number(req.params.id),req));}
async function confirmPlatformFee(req,res){res.json({message:'Collection confirmed',collection:await service.confirmPlatformFee(Number(req.params.id),req.body,req)});}
async function generators(req,res){res.json(await service.listGenerators());}
async function settings(req,res){res.json(await service.settings());}
async function updateSetting(req,res){res.json(await service.updateSetting(req.params.key,req.body.value,req));}
async function report(req,res){res.json(await service.reportSummary(req.query));}
async function audit(req,res){res.json(await service.listAudit({limit:req.query.limit||200}));}
module.exports={listRegistrationApplications,registrationApplication,assignSubscriberMeter,dashboard,listUsers,createUser,updateUser,deleteUser,confirmPlatformFee,generators,settings,updateSetting,report,audit};
