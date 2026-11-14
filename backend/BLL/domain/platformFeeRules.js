'use strict';
const AppError=require('../../utils/AppError');

function round4(value){const n=Number(value||0);return Number.isFinite(n)?Math.round(n*10000)/10000:0;}
function validatePeriod(month,year,now=new Date()){
  const m=Number(month||now.getMonth()+1); const y=Number(year||now.getFullYear());
  if(!Number.isInteger(m)||m<1||m>12)throw new AppError('Month must be between 1 and 12',422,'INVALID_MONTH');
  if(!Number.isInteger(y)||y<2020||y>2200)throw new AppError('Year is invalid',422,'INVALID_YEAR');
  return {month:m,year:y};
}
function daysInMonth(year,month){return new Date(Date.UTC(year,month,0)).getUTCDate();}
function periodRange(month,year){const p=validatePeriod(month,year);const mm=String(p.month).padStart(2,'0');return {start:`${p.year}-${mm}-01`,end:`${p.year}-${mm}-${String(daysInMonth(p.year,p.month)).padStart(2,'0')}`,...p};}
function normalizeFeeRate(value,fallback=0.10){const n=Number(value);return Number.isFinite(n)&&n>=0?n:Number(fallback);}
function calculateMonthlyFee(subscriberCount,feePerSubscriber){const count=Math.max(0,Number(subscriberCount||0));const rate=normalizeFeeRate(feePerSubscriber);return round4(count*rate);}
module.exports={round4,validatePeriod,periodRange,normalizeFeeRate,calculateMonthlyFee};
