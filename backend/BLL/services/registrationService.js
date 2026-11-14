'use strict';
const bcrypt=require('bcryptjs');
const repo=require('../../DAL/repositories/registrationRepository');
const users=require('../../DAL/repositories/userRepository');
const {registrationInput,assignmentInput,normalizedMeter}=require('../domain/registrationRules');
const AppError=require('../../utils/AppError');
const audit=require('./auditService');
const notifications=require('./notificationService');

async function register(data,req){
  const input=registrationInput(data);
  if(await users.findByUsername(input.username))throw new AppError('Username already exists',409,'USERNAME_EXISTS');
  if(input.email&&await users.findByEmail(input.email))throw new AppError('Email already exists',409,'EMAIL_EXISTS');
  const result=await repo.createApplication({...input,password_hash:await bcrypt.hash(data.password,12)});
  if(req)await audit.logFromRequest(req,'SUBSCRIBER_APPLICATION_SUBMITTED','registration_application',result.application_id,{user_id:result.user.id,generator_id:input.generator_id});
  // A notification delivery failure must not report a committed registration as failed.
  try{await notifications.notifyAdmins('system','New subscriber application',`${input.full_name} is awaiting meter assignment.`,'/admin/applications');}catch(err){console.error('Application notification failed:',err.message);}
  try{await notifications.notifyUser(result.owner_user_id,'system','New subscriber application',`${input.full_name} applied to your generator and is awaiting meter assignment.`,'/owner/applications');}catch(err){console.error('Owner application notification failed:',err.message);}
  return {...result.user,application:{id:result.application_id,status:'pending'}};
}
async function detail(id,ownerUserId=null){
  const application=await repo.getById(id,ownerUserId);
  if(!application)throw new AppError('Application not found',404,'APPLICATION_NOT_FOUND');
  return {application,plans:await repo.plansForApplication(id)};
}
async function assign(id,data,req){
  if(!['admin','owner'].includes(req?.user?.role))throw new AppError('Only the responsible generator owner or an administrator can assign a meter',403,'FORBIDDEN');
  const input=assignmentInput(data);
  const result=await repo.assignMeter(id,input,req.user.id,normalizedMeter(input.meter_number),req.user.role==='owner'?req.user.id:null);
  await audit.logFromRequest(req,'SUBSCRIBER_METER_ASSIGNED','registration_application',id,{meter_number:result.meter_number,subscriber_id:result.subscriber_id});
  try{await notifications.notifyUser(result.user_id,'system','Meter assigned',`Your meter number is ${result.meter_number}. View your subscription in your dashboard.`,'/subscriber');}catch(err){console.error('Meter assignment notification failed:',err.message);}
  return result;
}
module.exports={register,detail,assign,listDestinations:repo.listDestinations,listApplications:repo.listApplications,applicationForUser:repo.getByUserId};
