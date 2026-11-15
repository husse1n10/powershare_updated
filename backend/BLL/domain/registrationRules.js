'use strict';
const AppError=require('../../utils/AppError');
const {validateUsername,validatePassword,validateProfileData}=require('./accountRules');

function positiveId(value,label){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<1||n>2147483647)throw new AppError(`${label} is required`,422,'INVALID_APPLICATION');
  return n;
}
function registrationInput(data={}){
  const username=validateUsername(data.username);
  validatePassword(data.password);
  const full_name=String(data.full_name||'').trim();
  const phone=String(data.phone||'').trim();
  const email=String(data.email||'').trim().toLowerCase()||null;
  validateProfileData({full_name,phone,email,preferred_language:data.preferred_language||'en'});
  if(!/^\+961[0-9]{6,10}$/.test(phone))throw new AppError('Enter a Lebanese phone number beginning with +961',422,'INVALID_PHONE');
  if(data.meter_number!==undefined&&data.meter_number!==null&&String(data.meter_number).trim())throw new AppError('The generator owner or administrator assigns the meter number after registration',422,'METER_ASSIGNMENT_STAFF_ONLY');
  return {full_name,username,phone,email,preferred_language:data.preferred_language||'en'};
}
function applicationInput(data={}){
  const location_address=String(data.location_address||'').trim();
  if(location_address.length<2||location_address.length>400)throw new AppError('Installation address must be between 2 and 400 characters',422,'INVALID_ADDRESS');
  if(data.meter_number)throw new AppError('Only staff can assign a meter number',422,'METER_ASSIGNMENT_STAFF_ONLY');
  return {generator_id:positiveId(data.generator_id,'Generator'),location_address};
}
function assignmentInput(data={}){
  const meter_number=String(data.meter_number||'').trim();
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(meter_number))throw new AppError('Meter number must contain 1-100 letters, digits, dots, underscores or hyphens',422,'INVALID_METER_NUMBER');
  const initial_kwh_consumed=data.initial_kwh_consumed===undefined||data.initial_kwh_consumed===''?0:Number(data.initial_kwh_consumed);
  if(!Number.isFinite(initial_kwh_consumed)||initial_kwh_consumed<0||initial_kwh_consumed>9999999999.99)throw new AppError('Initial meter reading must be a valid nonnegative number',422,'INVALID_INITIAL_READING');
  const start_date=data.start_date||new Date().toISOString().slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start_date)||!Number.isFinite(Date.parse(start_date+'T00:00:00Z'))||new Date(start_date+'T00:00:00Z').toISOString().slice(0,10)!==start_date)throw new AppError('Enter a valid subscription start date',422,'INVALID_START_DATE');
  return {meter_number,plan_id:positiveId(data.plan_id,'Plan'),initial_kwh_consumed,start_date};
}
function normalizedMeter(value){return String(value).replace(/[^A-Za-z0-9]/g,'').toUpperCase();}
module.exports={registrationInput,applicationInput,assignmentInput,normalizedMeter};
