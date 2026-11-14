'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const userRepo = require('../../DAL/repositories/userRepository');
const profileRepo = require('../../DAL/repositories/profileRepository');
const accountRepo = require('../../DAL/repositories/accountRepository');
const AppError = require('../../utils/AppError');
const {validateUsername,validatePassword,validateProfileData}=require('../domain/accountRules');
const audit=require('./auditService');

const ACCESS_MINUTES = Number(process.env.ACCESS_TOKEN_MINUTES || 30);
const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 7);
function accessSecret(){ return process.env.JWT_SECRET || 'dev-access-secret-change-me'; }
function refreshSecret(){ return process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me'; }
function hashToken(token){ return crypto.createHash('sha256').update(token).digest('hex'); }
// DEF-068: a random jti makes every issued token unique; without it two tokens
// issued to the same user within one second were byte-identical.
function signAccess(user){ return jwt.sign({ sub:user.id, role:user.role, ver:Number(user.auth_version||1), type:'access', jti:crypto.randomUUID() }, accessSecret(), { expiresIn:`${ACCESS_MINUTES}m` }); }
function signRefresh(user){ return jwt.sign({ sub:user.id, role:user.role, ver:Number(user.auth_version||1), type:'refresh', jti:crypto.randomUUID() }, refreshSecret(), { expiresIn:`${REFRESH_DAYS}d` }); }
function publicUser(user){ const { password_hash, ...safe } = user; return safe; }

async function login(identifier,password,req=null){
  const id=String(identifier||'').trim();
  const user=await userRepo.findByIdentifier(id);
  if(!user || !user.is_active){if(req)await audit.logFromRequest(req,'LOGIN_FAILED','user',user?.id||null,{identifier:id});throw new AppError('Invalid credentials',401,'INVALID_CREDENTIALS');}
  const ok=await bcrypt.compare(String(password||''),user.password_hash);
  if(!ok){if(req)await audit.logFromRequest(req,'LOGIN_FAILED','user',user.id,{identifier:id});throw new AppError('Invalid credentials',401,'INVALID_CREDENTIALS');}
  const accessToken=signAccess(user); const refreshToken=signRefresh(user);
  const exp=new Date(Date.now()+REFRESH_DAYS*86400000);
  await userRepo.insertRefreshToken(user.id,hashToken(refreshToken),exp);
  if(req){req.user={id:user.id,role:user.role,full_name:user.full_name,username:user.username};await audit.logFromRequest(req,'LOGIN_SUCCESS','user',user.id);}
  return { accessToken, refreshToken, user:publicUser(user) };
}

async function refresh(refreshToken){
  if(!refreshToken) throw new AppError('Refresh token required',401,'REFRESH_REQUIRED');
  let payload; try { payload=jwt.verify(refreshToken,refreshSecret()); } catch { throw new AppError('Invalid refresh token',401,'INVALID_REFRESH'); }
  if(payload.type!=='refresh') throw new AppError('Invalid refresh token',401,'INVALID_REFRESH');
  const stored=await userRepo.findRefreshToken(hashToken(refreshToken));
  if(!stored) throw new AppError('Refresh token expired or revoked',401,'REFRESH_REVOKED');
  const user=await userRepo.findById(payload.sub);
  if(!user || !user.is_active) throw new AppError('Account inactive',403,'ACCOUNT_INACTIVE');
  if(Number(payload.ver||1)!==Number(user.auth_version||1)){await userRepo.deleteRefreshToken(hashToken(refreshToken));throw new AppError('Session has been invalidated',401,'SESSION_INVALIDATED');}
  // DEF-064: only the request that actually deletes the stored token may rotate it.
  const consumed=await userRepo.deleteRefreshToken(hashToken(refreshToken));
  if(Number(consumed?.affectedRows||0)!==1) throw new AppError('Refresh token expired or revoked',401,'REFRESH_REVOKED');
  const nextRefreshToken=signRefresh(user);
  const exp=new Date(Date.now()+REFRESH_DAYS*86400000);
  await userRepo.insertRefreshToken(user.id,hashToken(nextRefreshToken),exp);
  return { accessToken:signAccess(user), refreshToken:nextRefreshToken, user:publicUser(user) };
}

async function logout(refreshToken){ if(refreshToken) await userRepo.deleteRefreshToken(hashToken(refreshToken)); return true; }

async function registerSubscriber(data,req=null){return require('./registrationService').register(data,req);}

async function changePassword(userId,currentPassword,newPassword,req=null){
  validatePassword(newPassword);
  const user=await userRepo.findById(userId); if(!user) throw new AppError('User not found',404,'USER_NOT_FOUND');
  const ok=await bcrypt.compare(String(currentPassword||''),user.password_hash); if(!ok) throw new AppError('Current password is incorrect',400,'CURRENT_PASSWORD_INVALID');
  const hash=await bcrypt.hash(newPassword,12); await userRepo.update(userId,{password_hash:hash}); await userRepo.bumpAuthVersion(userId); await userRepo.deleteUserRefreshTokens(userId); if(req)await audit.logFromRequest(req,'PASSWORD_CHANGED','user',userId); return true;
}


async function me(userId){
  const user=await userRepo.findById(userId); if(!user) throw new AppError('User not found',404,'USER_NOT_FOUND');
  const safe=publicUser(user);
  if(user.role==='owner') safe.owner=await profileRepo.getOwnerByUserId(user.id);
  if(user.role==='collector') safe.collector=await profileRepo.getCollectorByUserId(user.id);
  if(user.role==='subscriber') safe.subscriber=await profileRepo.getSubscriberByUserId(user.id);
  return safe;
}

async function updateProfile(userId,data,req=null){
  validateProfileData(data);
  const fields={};
  if(data.full_name!==undefined)fields.full_name=String(data.full_name||'').trim();
  if(data.phone!==undefined)fields.phone=data.phone?String(data.phone).trim():null;
  if(data.preferred_language!==undefined)fields.preferred_language=data.preferred_language;
  if(data.email!==undefined){
    const email=data.email?String(data.email).trim().toLowerCase():null;
    const existing=email?await userRepo.findByEmail(email):null;
    if(existing&&Number(existing.id)!==Number(userId))throw new AppError('Email already taken',409,'EMAIL_EXISTS');
    fields.email=email;
  }
  if(data.username!==undefined){
    const username=validateUsername(data.username);
    const existing=await userRepo.findByUsername(username);
    if(existing && Number(existing.id)!==Number(userId)) throw new AppError('Username already taken',409,'USERNAME_EXISTS');
    fields.username=username;
  }
  let updated;
  try{
    updated=publicUser(await accountRepo.updateUserProfileAtomically(userId,fields));
  }catch(err){
    if(err?.code==='USER_NOT_FOUND')throw new AppError('User not found',404,'USER_NOT_FOUND');
    throw err;
  }
  if(req)await audit.logFromRequest(req,'PROFILE_UPDATED','user',userId,{fields:Object.keys(fields)}); return updated;
}

module.exports={login,refresh,logout,registerSubscriber,changePassword,updateProfile,me,signAccess,publicUser};
