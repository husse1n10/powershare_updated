'use strict';
const AppError=require('../../utils/AppError');

const SETTING_KEYS=new Set([
  'platform_name',
  'platform_fee_per_subscriber',
  'default_usd_lbp_rate',
  'simulated_online_payment_enabled',
  'support_email',
]);

function text(value){return String(value ?? '').trim();}
function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);}

function normalizePlatformSetting(key,value){
  const k=text(key);
  if(!SETTING_KEYS.has(k))throw new AppError('Unknown platform setting',422,'INVALID_PLATFORM_SETTING');

  if(k==='platform_name'){
    const v=text(value);
    if(v.length<2||v.length>80)throw new AppError('Platform name must be between 2 and 80 characters',422,'INVALID_PLATFORM_SETTING');
    return v;
  }

  if(k==='platform_fee_per_subscriber'){
    const n=Number(value);
    if(!Number.isFinite(n)||n<0||n>1000)throw new AppError('Platform fee must be between 0 and 1000 USD',422,'INVALID_PLATFORM_SETTING');
    return String(Math.round(n*10000)/10000);
  }

  if(k==='default_usd_lbp_rate'){
    const n=Number(value);
    if(!Number.isFinite(n)||n<=0||n>1_000_000_000)throw new AppError('Default USD/LBP rate must be greater than zero',422,'INVALID_PLATFORM_SETTING');
    return String(Math.round(n*100)/100);
  }

  if(k==='simulated_online_payment_enabled'){
    if(typeof value==='boolean')return value?'1':'0';
    const v=text(value).toLowerCase();
    if(['1','true','yes','on','enabled'].includes(v))return '1';
    if(['0','false','no','off','disabled'].includes(v))return '0';
    throw new AppError('Simulated payment setting must be enabled or disabled',422,'INVALID_PLATFORM_SETTING');
  }

  if(k==='support_email'){
    const v=text(value);
    if(v.length>150||!validEmail(v))throw new AppError('Support email is invalid',422,'INVALID_PLATFORM_SETTING');
    return v;
  }

  throw new AppError('Unknown platform setting',422,'INVALID_PLATFORM_SETTING');
}

module.exports={SETTING_KEYS,normalizePlatformSetting};
