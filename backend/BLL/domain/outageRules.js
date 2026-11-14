'use strict';
function validateOutage(input){
  const type=input?.schedule_type||'one_time';
  if(!['one_time','recurring'].includes(type)) return {valid:false,error:'Invalid schedule type'};
  if(!input?.start_time||!input?.end_time) return {valid:false,error:'Start and end time are required'};
  if(String(input.start_time)>=String(input.end_time)) return {valid:false,error:'End time must be after start time'};
  if(type==='one_time'&&!input?.outage_date) return {valid:false,error:'Outage date is required for one-time outages'};
  if(type==='recurring'&&!(Number.isInteger(Number(input?.day_of_week))&&Number(input.day_of_week)>=0&&Number(input.day_of_week)<=6)) return {valid:false,error:'Day of week must be between 0 and 6 for recurring outages'};
  return {valid:true};
}
module.exports={validateOutage};
