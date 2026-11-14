'use strict';
const repo=require('../../DAL/repositories/notificationRepository');
const AppError=require('../../utils/AppError');
const {normalizeLimit}=require('../domain/paginationRules');

let realtimeEmitter=null;
function setRealtimeEmitter(emitter){realtimeEmitter=typeof emitter==='function'?emitter:null;}

async function notifyUser(userId,type,title,message,actionUrl=null){if(!userId)return null;const row=await repo.create(userId,type,title,message,actionUrl);if(realtimeEmitter){try{realtimeEmitter(Number(userId),row);}catch(_){/* real-time delivery must never roll back the persisted notification */}}return row;}
async function notifyAdmins(type,title,message,actionUrl=null){const users=await repo.adminUserIds();for(const row of users)await notifyUser(row.user_id,type,title,message,actionUrl);return users.length;}
async function notifyGeneratorSubscribers(generatorId,type,title,message,actionUrl=null){const users=await repo.userIdsForGeneratorSubscribers(generatorId);for(const row of users)await notifyUser(row.user_id,type,title,message,actionUrl);return users.length;}
async function list(userId,limit=50){return repo.list(userId,normalizeLimit(limit));}
async function markRead(userId,id){const row=await repo.markRead(userId,id);if(!row)throw new AppError('Notification not found',404,'NOTIFICATION_NOT_FOUND');return row;}
async function markAllRead(userId){return repo.markAllRead(userId);}

module.exports={notifyUser,notifyAdmins,notifyGeneratorSubscribers,list,unreadCount:repo.unreadCount,markRead,markAllRead,normalizeLimit,setRealtimeEmitter};
