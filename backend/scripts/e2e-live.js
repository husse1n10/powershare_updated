'use strict';
require('dotenv').config();
const assert=require('node:assert/strict');
const app=require('../app');
const {pool}=require('../DAL/database/connection');

const PASSWORD=process.env.E2E_PASSWORD||'Admin@123456';
const USERS={admin:'admin',owner:'owner',collector:'collector',subscriber:'subscriber'};

async function request(base,method,url,{token,body}={}){
  const res=await fetch(`${base}${url}`,{
    method,
    headers:{...(token?{Authorization:`Bearer ${token}`}:{Accept:'application/json'}),...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined,
  });
  const text=await res.text();
  let data=null;try{data=text?JSON.parse(text):null;}catch{data=text;}
  if(!res.ok){const err=new Error(`${method} ${url} -> ${res.status}: ${data?.error||text}`);err.status=res.status;err.data=data;throw err;}
  return data;
}
async function login(base,username){const data=await request(base,'POST','/api/auth/login',{body:{username,password:PASSWORD}});assert.ok(data.accessToken,`${username} login returned access token`);return data.accessToken;}

async function main(){
  const server=app.listen(0,'127.0.0.1');
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  const port=server.address().port;const base=`http://127.0.0.1:${port}`;
  const checks=[];const check=(name)=>{checks.push(name);console.log(`PASS ${name}`);};
  try{
    const health=await request(base,'GET','/api/health');assert.equal(health.status,'ok');check('E2E-HEALTH-001 API health');
    const ready=await request(base,'GET','/api/ready');assert.equal(ready.status,'ready');assert.equal(ready.database,'ok');check('E2E-READY-001 database readiness');
    const tokens={};for(const [role,user] of Object.entries(USERS)){tokens[role]=await login(base,user);check(`E2E-AUTH-${role.toUpperCase()} login`);}

    const adminDash=await request(base,'GET','/api/admin/dashboard',{token:tokens.admin});assert.ok('total_owners' in adminDash);check('E2E-ADMIN-001 admin dashboard');
    const ownerDash=await request(base,'GET','/api/owner/dashboard',{token:tokens.owner});assert.ok('total_generators' in ownerDash);check('E2E-OWNER-001 owner dashboard');
    const subs=await request(base,'GET','/api/owner/subscribers',{token:tokens.owner});assert.ok(Array.isArray(subs)&&subs.length,'Seeded subscriber exists');
    const plans=await request(base,'GET','/api/owner/plans',{token:tokens.owner});assert.ok(Array.isArray(plans)&&plans.length,'Seeded plan exists');
    check('E2E-MASTER-001 owner master data');

    const now=new Date();const month=Number(process.env.E2E_MONTH||now.getUTCMonth()+1);const year=Number(process.env.E2E_YEAR||now.getUTCFullYear());
    const sub=subs.find(x=>Number(x.subscription_active||x.sub_active||x.is_active)===1)||subs[0];
    const plan=plans.find(x=>Number(x.id)===Number(sub.plan_id))||plans[0];
    await request(base,'PUT','/api/owner/plan-pricing-rules',{token:tokens.owner,body:{plan_id:plan.id,month,year,threshold_kwh:100,base_cost_below_lbp:10000,base_cost_above_lbp:12000,maintenance_lbp:500000,usd_lbp_rate:89700}});
    check('E2E-PRICE-001 monthly pricing save');

    let bills=await request(base,'GET','/api/owner/bills',{token:tokens.owner});
    let bill=bills.find(b=>Number(b.subscription_id)===Number(sub.subscription_id)&&Number(b.month)===month&&Number(b.year)===year);
    if(!bill){
      const previous=Number(sub.last_reading_value??sub.initial_kwh_consumed??0);
      bill=await request(base,'POST','/api/owner/bills',{token:tokens.owner,body:{subscription_id:sub.subscription_id,month,year,previous_reading:previous,new_meter_reading:previous+50,notes:'Live QA E2E invoice'}});
    }
    assert.ok(bill.id);check('E2E-BILL-001 invoice available');

    if(['unpaid','partially_paid'].includes(bill.status)){
      const reminder=await request(base,'POST',`/api/owner/bills/${bill.id}/remind`,{token:tokens.owner});assert.match(reminder.message,/reminder sent/i);check('E2E-NOTIFY-001 balance reminder');
    }

    const collectorBills=await request(base,'GET','/api/collector/bills',{token:tokens.collector});
    const collectorBill=collectorBills.find(x=>Number(x.id)===Number(bill.id));assert.ok(collectorBill,'Collector can see assigned bill');
    if(['unpaid','partially_paid'].includes(collectorBill.status)&&Number(collectorBill.remaining_balance_lbp)>1000){
      const pay=await request(base,'PUT',`/api/collector/bills/${bill.id}/pay`,{token:tokens.collector,body:{amount_lbp:1000,notes:'Live QA E2E collection'}});assert.ok(pay.payment_id);check('E2E-PAY-001 collector partial payment');
    }

    const wallet=await request(base,'GET','/api/collector/wallet',{token:tokens.collector});assert.ok(Number(wallet.balance_lbp)>=0);check('E2E-COLLECTOR-001 collector wallet');
    if(Number(wallet.balance_lbp)>=500){
      const settlements=await request(base,'GET','/api/collector/settlements',{token:tokens.collector});
      let pending=settlements.find(x=>x.status==='pending');
      if(!pending) pending=await request(base,'POST','/api/collector/settlements/request',{token:tokens.collector,body:{amount_lbp:500,notes:'Live QA E2E settlement'}});
      const ownerSettlements=await request(base,'GET','/api/owner/collector/settlements',{token:tokens.owner});
      const target=ownerSettlements.find(x=>Number(x.id)===Number(pending.id)&&x.status==='pending');
      if(target){await request(base,'PUT',`/api/owner/collector/settlements/${target.id}/confirm`,{token:tokens.owner,body:{notes:'Live QA E2E confirmation'}});check('E2E-SETTLEMENT-001 collector settlement');}
    }

    const subscriberBills=await request(base,'GET','/api/subscriber/bills',{token:tokens.subscriber});assert.ok(subscriberBills.some(x=>Number(x.id)===Number(bill.id)));check('E2E-PORTAL-001 subscriber bill visibility');
    const notifications=await request(base,'GET','/api/notifications?limit=100',{token:tokens.subscriber});assert.ok(Array.isArray(notifications.items));check('E2E-NOTIFY-002 subscriber notifications');

    const ticket=await request(base,'POST','/api/support/tickets',{token:tokens.subscriber,body:{subject:'Live QA test ticket',category:'technical',description:'Created by the automated live end-to-end QA workflow.',priority:'low'}});assert.ok(ticket.id);check('E2E-SUPPORT-001 support ticket create');
    const ownerTickets=await request(base,'GET','/api/support/tickets',{token:tokens.owner});assert.ok(ownerTickets.some(x=>Number(x.id)===Number(ticket.id)));check('E2E-SUPPORT-002 owner receives tenant ticket');

    const report=await request(base,'GET',`/api/owner/reports/summary?month=${month}&year=${year}`,{token:tokens.owner});assert.equal(Number(report.period.month),month);assert.equal(Number(report.period.year),year);check('E2E-REPORT-001 owner period report');

    console.log(`Live E2E completed: ${checks.length}/${checks.length} checks passed.`);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    await pool.end();
  }
}

main().catch(async err=>{console.error('LIVE E2E FAILED:',err.stack||err.message);try{await pool.end();}catch{}process.exit(1);});
