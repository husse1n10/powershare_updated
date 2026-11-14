'use strict';
const jwt=require('jsonwebtoken');
const userRepo=require('../../DAL/repositories/userRepository');
const AppError=require('../../utils/AppError');

function accessSecret(){return process.env.JWT_SECRET||'dev-access-secret-change-me';}

async function authenticateAccessToken(token){
  if(!token)throw new AppError('Authentication required',401,'AUTH_REQUIRED');
  let payload;
  try{payload=jwt.verify(token,accessSecret());}
  catch(err){throw new AppError(err?.name==='TokenExpiredError'?'Access token expired':'Invalid token',401,err?.name==='TokenExpiredError'?'TOKEN_EXPIRED':'INVALID_TOKEN');}
  if(payload.type!=='access')throw new AppError('Invalid token',401,'INVALID_TOKEN');
  const user=await userRepo.findById(payload.sub);
  if(!user||!user.is_active)throw new AppError('Account inactive',403,'ACCOUNT_INACTIVE');
  if(Number(payload.ver||1)!==Number(user.auth_version||1))throw new AppError('Session has been invalidated',401,'SESSION_INVALIDATED');
  return {id:user.id,role:user.role,full_name:user.full_name,username:user.username};
}

module.exports={authenticateAccessToken};
