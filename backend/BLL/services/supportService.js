'use strict';
const supportRepo=require('../../DAL/repositories/supportRepository');
const profileRepo=require('../../DAL/repositories/profileRepository');
const notifications=require('./notificationService');
const audit=require('./auditService');
const AppError=require('../../utils/AppError');

async function ownerContext(user){
  if(user.role==='owner'){const o=await profileRepo.getOwnerByUserId(user.id);return o?.id||null;}
  if(user.role==='collector'){const c=await profileRepo.getCollectorByUserId(user.id);return c?.owner_id||null;}
  if(user.role==='subscriber'){const s=await profileRepo.getSubscriberByUserId(user.id);return s?.created_by_owner||null;}
  return null;
}
async function ownerUserId(ownerId){if(!ownerId)return null;return (await profileRepo.getOwnerById(ownerId))?.user_id||null;}
async function notifyOwner(ownerId,excludeUserId,title,message,ticketId){const uid=await ownerUserId(ownerId);if(uid&&Number(uid)!==Number(excludeUserId))await notifications.notifyUser(uid,'support',title,message,`/support?ticket=${ticketId}`);}

async function create(user,data,req){
  const ticket=await supportRepo.create({created_by:user.id,owner_id:await ownerContext(user),subject:data.subject,category:data.category,description:data.description,priority:data.priority});
  if(user.role==='owner')await notifications.notifyAdmins('support','New support ticket',`${user.full_name||'Generator owner'} opened ticket #${ticket.id}: ${ticket.subject}`,`/support?ticket=${ticket.id}`);
  else if(ticket.owner_id)await notifyOwner(ticket.owner_id,user.id,'New support ticket',`${user.full_name||'A user'} opened ticket #${ticket.id}: ${ticket.subject}`,ticket.id);
  await audit.logFromRequest(req,'SUPPORT_TICKET_CREATED','support_ticket',ticket.id);
  return ticket;
}
async function list(user){return supportRepo.listForUser(user);}
async function detail(user,id){
  const ticket=await supportRepo.getById(id);
  if(!ticket)throw new AppError('Ticket not found',404,'TICKET_NOT_FOUND');
  const allowed=user.role==='admin'||ticket.created_by===user.id||(user.role==='owner'&&ticket.owner_id===(await ownerContext(user)));
  if(!allowed)throw new AppError('Access denied',403,'FORBIDDEN');
  return {...ticket,replies:await supportRepo.replies(id)};
}
async function reply(user,id,message,req){
  const ticket=await detail(user,id);
  if(ticket.status==='closed'&&user.role!=='admin')throw new AppError('Closed tickets cannot receive new replies',409,'TICKET_CLOSED');
  const r=await supportRepo.addReply(id,user.id,message);
  if(Number(ticket.created_by)!==Number(user.id))await notifications.notifyUser(ticket.created_by,'support','Support ticket reply',`Ticket #${id} received a new reply.`,`/support?ticket=${id}`);
  if(ticket.owner_id&&user.role!=='owner'&&Number(ticket.created_by)!==Number((await ownerUserId(ticket.owner_id))||0))await notifyOwner(ticket.owner_id,user.id,'Support ticket updated',`Ticket #${id} received a new reply.`,id);
  await audit.logFromRequest(req,'SUPPORT_REPLY_ADDED','support_ticket',id);
  return r;
}
async function updateStatus(user,id,status,req){
  if(!['admin','owner'].includes(user.role))throw new AppError('Access denied',403,'FORBIDDEN');
  const ticket=await detail(user,id);
  const r=await supportRepo.updateStatus(id,status);
  if(Number(ticket.created_by)!==Number(user.id))await notifications.notifyUser(ticket.created_by,'support','Support ticket status',`Ticket #${id} is now ${status.replace('_',' ')}.`,`/support?ticket=${id}`);
  await audit.logFromRequest(req,'SUPPORT_STATUS_CHANGED','support_ticket',id,{status});
  return r;
}
module.exports={create,list,detail,reply,updateStatus};
