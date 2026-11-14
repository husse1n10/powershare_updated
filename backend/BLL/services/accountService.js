'use strict';
const bcrypt=require('bcryptjs');
const userRepo=require('../../DAL/repositories/userRepository');
const accountRepo=require('../../DAL/repositories/accountRepository');
const AppError=require('../../utils/AppError');
const {validateUsername,validatePassword,validateRoleCreationContext}=require('../domain/accountRules');
async function createUser(data,{ownerId=null}={}){
  const role=data.role;
  if(!['admin','owner','collector','subscriber'].includes(role))throw new AppError('Invalid role',422,'INVALID_ROLE');
  validateRoleCreationContext(role,{ownerId});
  const username=validateUsername(data.username); validatePassword(data.password);
  if(await userRepo.findByUsername(username))throw new AppError('Username already taken',409,'USERNAME_EXISTS');
  if(data.email&&await userRepo.findByEmail(data.email))throw new AppError('Email already taken',409,'EMAIL_EXISTS');
  if(role==='subscriber'&&!data.subscriber_profile_id)throw new AppError('Subscriber profile is required',422,'SUBSCRIBER_PROFILE_REQUIRED');
  const hash=await bcrypt.hash(data.password,12);
  try{
    return await accountRepo.createUserWithRoleProfile({full_name:data.full_name,username,email:data.email,phone:data.phone,password_hash:hash,role,is_active:data.is_active??1,preferred_language:data.preferred_language||'en',business_name:data.business_name,company_address:data.company_address},{ownerId,subscriberProfileId:data.subscriber_profile_id||null});
  }catch(err){
    if(err?.code==='OWNER_NOT_FOUND')throw new AppError('Generator owner not found',404,'OWNER_NOT_FOUND');
    if(err?.code==='SUBSCRIBER_PROFILE_NOT_FOUND')throw new AppError('Subscriber profile not found',404,'SUBSCRIBER_PROFILE_NOT_FOUND');
    if(err?.code==='SUBSCRIBER_OWNER_MISMATCH')throw new AppError('Subscriber does not belong to this generator owner',403,'SUBSCRIBER_OWNER_MISMATCH');
    if(err?.code==='ACCOUNT_EXISTS')throw new AppError('Subscriber already has an account',409,'ACCOUNT_EXISTS');
    if(err?.code==='ACCOUNT_LINK_CONFLICT')throw new AppError('Subscriber account changed while it was being created. Reload and try again.',409,'ACCOUNT_LINK_CONFLICT');
    throw err;
  }
}
async function updateUser(id,data){
  const current=await userRepo.findById(id); if(!current)throw new AppError('User not found',404,'USER_NOT_FOUND');
  const fields={};
  if(data.full_name!==undefined)fields.full_name=String(data.full_name||'').trim();
  if(data.phone!==undefined)fields.phone=data.phone?String(data.phone).trim():null;
  if(data.preferred_language!==undefined)fields.preferred_language=data.preferred_language;
  if(data.is_active!==undefined)fields.is_active=data.is_active;
  if(data.username!==undefined){
    const username=validateUsername(data.username);
    const existing=await userRepo.findByUsername(username);
    if(existing&&Number(existing.id)!==Number(id))throw new AppError('Username already taken',409,'USERNAME_EXISTS');
    fields.username=username;
  }
  if(data.email!==undefined){
    const email=data.email?String(data.email).trim().toLowerCase():null;
    const existing=email?await userRepo.findByEmail(email):null;
    if(existing&&Number(existing.id)!==Number(id))throw new AppError('Email already taken',409,'EMAIL_EXISTS');
    fields.email=email;
  }
  const passwordChanged=!!data.password;
  if(passwordChanged){validatePassword(data.password);fields.password_hash=await bcrypt.hash(data.password,12);}
  const updated=await userRepo.update(id,fields);
  if(passwordChanged){await userRepo.bumpAuthVersion(id);await userRepo.deleteUserRefreshTokens(id);return userRepo.findById(id);}
  return updated;
}
module.exports={createUser,updateUser};
