'use strict';

function text(value){return String(value ?? '').trim();}
function finiteNumber(value){
  if(value === '' || value === null || value === undefined) return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}
function requireText(value,label,max=400){
  const v=text(value);
  if(!v) return `${label} is required`;
  if(v.length>max) return `${label} is too long`;
  return null;
}
function nonNegative(value,label,{allowNull=false}={}){
  if((value===null||value===undefined||value==='') && allowNull) return null;
  const n=finiteNumber(value);
  if(n===null||n<0) return `${label} must be a non-negative number`;
  return null;
}
function positive(value,label){
  const n=finiteNumber(value);
  if(n===null||n<=0) return `${label} must be greater than zero`;
  return null;
}
function integerInRange(value,label,min,max){
  const n=Number(value);
  if(!Number.isInteger(n)||n<min||n>max) return `${label} must be between ${min} and ${max}`;
  return null;
}
function result(error){return error?{valid:false,error}:{valid:true};}

function validateGenerator(data={},partial=false){
  let e;
  if(!partial || data.name!==undefined){e=requireText(data.name,'Generator name',200);if(e)return result(e);}
  if(!partial || data.location_name!==undefined){e=requireText(data.location_name,'Generator location',300);if(e)return result(e);}
  if(data.total_kw!==undefined){e=nonNegative(data.total_kw,'Generator capacity');if(e)return result(e);}
  if(data.max_amperage!==undefined){e=nonNegative(data.max_amperage,'Maximum amperage',{allowNull:true});if(e)return result(e);}
  if(data.status!==undefined&&!['active','inactive','maintenance'].includes(String(data.status)))return result('Invalid generator status');
  return result();
}

function validateMainMeter(data={},partial=false){
  let e;
  if(!partial || data.meter_number!==undefined){e=requireText(data.meter_number,'Meter number',120);if(e)return result(e);}
  if(data.initial_kwh!==undefined){e=nonNegative(data.initial_kwh,'Initial meter reading');if(e)return result(e);}
  return result();
}

function validatePlan(data={},partial=false){
  let e;
  if(!partial || data.name!==undefined){e=requireText(data.name,'Plan name',150);if(e)return result(e);}
  if(!partial || data.ampere!==undefined){e=positive(data.ampere,'Ampere');if(e)return result(e);}
  if(data.monthly_cost_lbp!==undefined){e=nonNegative(data.monthly_cost_lbp,'Monthly cost');if(e)return result(e);}
  if(data.maintenance_lbp!==undefined){e=nonNegative(data.maintenance_lbp,'Maintenance charge');if(e)return result(e);}
  return result();
}

function validatePricing(data={}){
  let e;
  e=integerInRange(Number(data.month),'Month',1,12);if(e)return result(e);
  e=integerInRange(Number(data.year),'Year',2020,2100);if(e)return result(e);
  e=nonNegative(data.threshold_kwh ?? 0,'Threshold kWh');if(e)return result(e);
  e=nonNegative(data.base_cost_below_lbp ?? 0,'Below-threshold price');if(e)return result(e);
  e=nonNegative(data.base_cost_above_lbp ?? 0,'Above-threshold price');if(e)return result(e);
  e=nonNegative(data.maintenance_lbp ?? 0,'Maintenance charge');if(e)return result(e);
  e=positive(data.usd_lbp_rate,'USD/LBP exchange rate');if(e)return result(e);
  return result();
}

function validateSubscriber(data={},partial=false){
  let e;
  if(!partial || data.full_name!==undefined){e=requireText(data.full_name,'Subscriber name',150);if(e)return result(e);}
  if(!partial || data.location_address!==undefined){e=requireText(data.location_address,'Subscriber address',400);if(e)return result(e);}
  if(data.meter_number!==undefined && data.meter_number!==null && text(data.meter_number).length>100)return result('Meter number is too long');
  if(data.initial_kwh_consumed!==undefined){e=nonNegative(data.initial_kwh_consumed,'Initial meter reading');if(e)return result(e);}
  if(data.fixed_amount_usd!==undefined){e=nonNegative(data.fixed_amount_usd,'Fixed monthly amount');if(e)return result(e);}
  const fixedEnabled=data.fixed_amount_enabled===true||Number(data.fixed_amount_enabled)===1;
  if(fixedEnabled && finiteNumber(data.fixed_amount_usd)<=0)return result('Fixed monthly amount must be greater than zero when fixed billing is enabled');
  if(data.account_status!==undefined&&!['active','inactive'].includes(String(data.account_status)))return result('Invalid subscriber account status');
  if(data.start_date!==undefined && data.start_date!==null && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.start_date)))return result('Start date must use YYYY-MM-DD format');
  return result();
}

function validateOwnerSettings(data={}){
  let e;
  if(data.vat_rate!==undefined){const n=finiteNumber(data.vat_rate);if(n===null||n<0||n>100)return result('VAT rate must be between 0 and 100');}
  if(data.usd_lbp_rate!==undefined){e=positive(data.usd_lbp_rate,'USD/LBP exchange rate');if(e)return result(e);}
  if(data.capital_lbp!==undefined){e=nonNegative(data.capital_lbp,'Capital');if(e)return result(e);}
  if(data.invoice_prefix!==undefined){e=requireText(data.invoice_prefix,'Invoice prefix',20);if(e)return result(e);if(!/^[A-Za-z0-9_-]+$/.test(text(data.invoice_prefix)))return result('Invoice prefix may contain only letters, numbers, hyphen and underscore');}
  return result();
}

// DEF-060: partial updates keep stored values instead of failing or resetting them.
function provided(v){return v!==undefined&&v!==null&&v!=='';}
function mergePricingInput(input={},existing=null,defaultRate){
  const pick=(k,fallback)=>provided(input[k])?input[k]:(existing&&existing[k]!==undefined&&existing[k]!==null?existing[k]:fallback);
  const below=pick('base_cost_below_lbp',0);
  return {plan_id:input.plan_id,month:input.month,year:input.year,threshold_kwh:pick('threshold_kwh',100),base_cost_below_lbp:below,base_cost_above_lbp:pick('base_cost_above_lbp',below),maintenance_lbp:pick('maintenance_lbp',0),usd_lbp_rate:pick('usd_lbp_rate',defaultRate)};
}
function mergeMainMeterInput(input={},current={}){
  return {meter_number:provided(input.meter_number)?String(input.meter_number).trim():current.meter_number,initial_kwh:provided(input.initial_kwh)?input.initial_kwh:current.initial_kwh,is_active:input.is_active!==undefined?input.is_active:current.is_active,notes:input.notes!==undefined?input.notes:current.notes};
}
module.exports={mergePricingInput,mergeMainMeterInput,validateGenerator,validateMainMeter,validatePlan,validatePricing,validateSubscriber,validateOwnerSettings};
