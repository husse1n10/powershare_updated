'use strict';
const AppError=require('../../utils/AppError');

function normalizeUsername(value){return String(value||'').trim();}
function validateUsername(value){
  const username=normalizeUsername(value);
  if(username.length<3)throw new AppError('Username must be at least 3 characters',422,'INVALID_USERNAME');
  if(username.length>80)throw new AppError('Username must be 80 characters or fewer',422,'INVALID_USERNAME');
  if(!/^[A-Za-z0-9_.-]+$/.test(username))throw new AppError('Username may contain letters, numbers, dot, underscore and hyphen only',422,'INVALID_USERNAME');
  return username;
}
function validateRoleCreationContext(role,{ownerId=null}={}){
  if(role==='collector'&&!ownerId)throw new AppError('Owner is required for collector',422,'OWNER_REQUIRED');
  return true;
}
function validatePassword(value){
  const password=String(value??'');
  // Client requirement: minimum four letters/digits; do not silently raise to 8+.
  if(password.length<4)throw new AppError('Password must be at least 4 characters',422,'WEAK_PASSWORD');
  if(password.length>128)throw new AppError('Password must be 128 characters or fewer',422,'INVALID_PASSWORD_LENGTH');
  if(!/^[A-Za-z0-9]+$/.test(password))throw new AppError('Password must contain letters and/or digits only',422,'INVALID_PASSWORD_FORMAT');
  return password;
}
function validateProfileData(data={}){
  if(data.full_name!==undefined){const name=String(data.full_name||'').trim();if(name.length<2||name.length>150)throw new AppError('Full name must be between 2 and 150 characters',422,'INVALID_FULL_NAME');}
  if(data.email!==undefined&&data.email!==null&&String(data.email).trim()){const email=String(data.email).trim();if(email.length>150||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new AppError('Invalid email address',422,'INVALID_EMAIL');}
  if(data.phone!==undefined&&data.phone!==null&&String(data.phone).trim()){const phone=String(data.phone).trim();if(phone.length>30||!/^[+0-9() .-]+$/.test(phone))throw new AppError('Invalid phone number',422,'INVALID_PHONE');}
  if(data.preferred_language!==undefined&&!['en','ar'].includes(String(data.preferred_language)))throw new AppError('Preferred language must be en or ar',422,'INVALID_LANGUAGE');
  return true;
}
module.exports={normalizeUsername,validateUsername,validateRoleCreationContext,validatePassword,validateProfileData};
