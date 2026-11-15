'use strict';
const publicUser=require('../../utils/publicUser');
const users=require('../../DAL/repositories/userRepository');
const generators=require('../../DAL/repositories/generatorRepository');
const admin=require('../../DAL/repositories/adminRepository');
const audit=require('./auditService');
const account=require('./accountService');
const profiles=require('../../DAL/repositories/profileRepository');
const {validatePeriod,periodRange,normalizeFeeRate,calculateMonthlyFee}=require('../domain/platformFeeRules');
const {normalizePlatformSetting}=require('../domain/platformSettingRules');
const AppError=require('../../utils/AppError');

async function syncPlatformFees(month,year){
  const p=periodRange(month,year);
  const [feeSetting,owners]=await Promise.all([admin.getSettingValue('platform_fee_per_subscriber'),admin.activeSubscriberCounts(p.start,p.end)]);
  const fee=normalizeFeeRate(feeSetting,0.10);
  const rows=owners.map(o=>({owner_id:Number(o.owner_id),subscriber_count:Number(o.subscriber_count||0),fee_per_subscriber_usd:fee,expected_amount_usd:calculateMonthlyFee(o.subscriber_count,fee)}));
  await admin.upsertPlatformFeeCollections(p.month,p.year,rows);
  return p;
}
async function dashboard(q={}){
  const p=validatePeriod(q.month,q.year); await syncPlatformFees(p.month,p.year);
  const [base,fees]=await Promise.all([admin.dashboardBase(p.month,p.year),admin.platformFeeSnapshot(p.month,p.year)]);
  const {totals,billing,recent}=base;
  return {...totals,...billing,unpaid_bills:Number(billing?.open_bills||0),total_platform_revenue:fees.totals.total_amount_usd,collected_revenue:fees.totals.collected_amount_usd,pending_revenue:fees.totals.pending_amount_usd,platform_fee_collections:fees.rows,period:p,recentBills:recent};
}
async function listUsers(q){return users.list(q);}
async function createUser(data,req){const user=await account.createUser(data);await audit.logFromRequest(req,'USER_CREATED','user',user.id,{role:user.role});return user;}
async function updateUser(id,data,req){const current=await users.findById(id);if(!current)throw new AppError('User not found',404,'USER_NOT_FOUND');if(current.role==='admin'&&id!==req.user.id)throw new AppError('Admin accounts cannot be edited here',403,'ADMIN_PROTECTED');const u=await account.updateUser(id,data);if(current.role==='owner'&&data.business_name!==undefined)await profiles.updateOwnerByUserId(id,{business_name:data.business_name});await audit.logFromRequest(req,'USER_UPDATED','user',id);return u;}
async function deactivateUser(id,req){if(Number(id)===req.user.id)throw new AppError('Cannot deactivate your own account',400,'SELF_DEACTIVATE');const current=await users.findById(id);if(!current)throw new AppError('User not found',404,'USER_NOT_FOUND');if(current.role==='admin')throw new AppError('Admin accounts cannot be deactivated',403,'ADMIN_PROTECTED');const u=await users.deactivate(id);await users.deleteUserRefreshTokens(id);await audit.logFromRequest(req,'USER_DEACTIVATED','user',id);return publicUser(u);}
async function confirmPlatformFee(id,data,req){const result=await admin.confirmPlatformFee(id,req.user.id,data?.notes);if(!result)throw new AppError('Collection item not found',404,'PLATFORM_FEE_NOT_FOUND');if(result.alreadyReceived)throw new AppError('Already confirmed as received',409,'PLATFORM_FEE_ALREADY_RECEIVED');await audit.logFromRequest(req,'PLATFORM_FEE_CONFIRMED','platform_fee_collection',id,{amount_usd:result.collection.expected_amount_usd});return result.collection;}
async function updateSetting(key,value,req){const normalized=normalizePlatformSetting(key,value);const row=await admin.updateSetting(key,normalized);await audit.logFromRequest(req,'PLATFORM_SETTING_UPDATED','platform_setting',key,{value:normalized});return row;}
async function reportSummary(q={}){const p=validatePeriod(q.month,q.year);await syncPlatformFees(p.month,p.year);return admin.reportSummary(p.month,p.year);}
module.exports={dashboard,listUsers,createUser,updateUser,deactivateUser,confirmPlatformFee,listGenerators:generators.listAll,settings:admin.settings,updateSetting,reportSummary,listAudit:audit.list};
