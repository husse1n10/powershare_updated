'use strict';
// Live test harness: real Express app + Socket.IO + MySQL. No mocks.
// Requires an initialized database with the QA demo seed (npm run db:init && npm run db:seed:demo).
const path=require('node:path');
const os=require('node:os');
const fs=require('node:fs');
const assert=require('node:assert/strict');
require('dotenv').config({path:path.resolve(__dirname,'../../.env')});
process.env.UPLOAD_DIR=process.env.UPLOAD_DIR||path.join(os.tmpdir(),`powershare-live-uploads-${process.pid}`);
const http=require('node:http');
const app=require('../../app');
const {attachSocketServer}=require('../../PL/realtime/socketServer');
const db=require('../../DAL/database/connection');
const {uploadDir}=require('../../middleware/upload');

const DEMO_PASSWORD=process.env.E2E_PASSWORD||'Admin@123456';
const PASSWORD='Pass1234';
const uid=()=>`${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;
const num=v=>Number(v);

async function startServer(){
  const server=http.createServer(app);
  const io=attachSocketServer(server,{origin:'http://localhost:3000'});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const base=`http://127.0.0.1:${server.address().port}`;
  async function call(method,url,{token,body,cookie,form}={}){
    const headers={};
    if(token)headers.Authorization=`Bearer ${token}`;
    if(cookie)headers.Cookie=cookie;
    let payload;
    if(form)payload=form;else if(body!==undefined){headers['Content-Type']='application/json';payload=JSON.stringify(body);}
    const res=await fetch(base+url,{method,headers,body:payload});
    const text=await res.text();let data;try{data=text?JSON.parse(text):null;}catch{data=text;}
    return {status:res.status,data,headers:res.headers};
  }
  async function login(username,password=PASSWORD){
    const r=await call('POST','/api/auth/login',{body:{username,password}});
    if(r.status!==200)throw new Error(`login ${username} failed: ${r.status} ${JSON.stringify(r.data)}`);
    return r.data.accessToken;
  }
  const ctx={server,io,base,call,login};
  ctx.adminToken=await login('admin',DEMO_PASSWORD);
  return ctx;
}
async function stopServer(ctx){
  if(ctx?.io)await new Promise(resolve=>ctx.io.close(()=>resolve()));
  await db.pool.end();
}
function expectStatus(r,status,msg=''){assert.equal(r.status,status,`${msg} -> ${r.status} ${JSON.stringify(r.data)}`);return r.data;}

async function setPrice(ctx,T,month,year,{price=10000,rate=90000,maintenance=0,threshold=1000,plan=T.plan}={}){
  return expectStatus(await ctx.call('PUT','/api/owner/plan-pricing-rules',{token:T.token,body:{plan_id:plan.id,month,year,threshold_kwh:threshold,base_cost_below_lbp:price,base_cost_above_lbp:price,maintenance_lbp:maintenance,usd_lbp_rate:rate}}),200,'set price');
}
// Owner tenant with VAT 0, rate 90,000, plan priced at 10,000 LBP/kWh for the given periods.
async function createTenant(ctx,tag,{months=[]}={}){
  const u=uid();const username=`own${tag}${u}`;
  const user=expectStatus(await ctx.call('POST','/api/admin/users',{token:ctx.adminToken,body:{full_name:`Owner ${tag}`,username,password:PASSWORD,role:'owner',business_name:`Biz ${tag}`}}),201,'create owner');
  const token=await ctx.login(username);
  expectStatus(await ctx.call('PUT','/api/owner/settings',{token,body:{vat_rate:0,usd_lbp_rate:90000}}),200,'owner settings');
  const generator=expectStatus(await ctx.call('POST','/api/owner/generators',{token,body:{name:`Gen ${tag}`,location_name:'Beirut',total_kw:100}}),201,'generator');
  const plan=expectStatus(await ctx.call('POST','/api/owner/plans',{token,body:{generator_id:generator.id,name:'10A',ampere:10,monthly_cost_lbp:900000,maintenance_lbp:0}}),201,'plan');
  const mainMeter=expectStatus(await ctx.call('POST','/api/owner/main-meters',{token,body:{meter_number:`MM${tag}${u}`,initial_kwh:0}}),201,'main meter');
  const T={tag,u,username,token,userId:user.id,generator,plan,mainMeter};
  for(const [m,y] of months)await setPrice(ctx,T,m,y);
  return T;
}
let seq=0;
async function createSubscriber(ctx,T,{initial=1000,fixedUsd=null,phone=null,meter=null,plan=T.plan}={}){
  seq+=1;const meterNumber=meter||`S${T.tag}${T.u}${seq}`;
  const body={full_name:`Subscriber ${seq}`,location_address:'Main street',plan_id:plan.id,meter_number:meterNumber,initial_kwh_consumed:initial,phone:phone||`+9617${String(Date.now()).slice(-6)}${seq}`};
  if(fixedUsd!==null){body.fixed_amount_enabled=true;body.fixed_amount_usd=fixedUsd;}
  const ids=expectStatus(await ctx.call('POST','/api/owner/subscribers/create',{token:T.token,body}),201,'create subscriber');
  return {...ids,meter_number:meterNumber,phone:body.phone};
}
async function createSubscriberAccount(ctx,T,sub){
  const username=`sub${T.tag}${uid()}`;
  const user=expectStatus(await ctx.call('POST',`/api/owner/subscribers/${sub.subscriber_id}/account`,{token:T.token,body:{username,password:PASSWORD}}),201,'subscriber account');
  return {username,userId:user.id,token:await ctx.login(username)};
}
async function createCollector(ctx,T){
  const username=`col${T.tag}${uid()}`;
  const user=expectStatus(await ctx.call('POST','/api/owner/collector/create',{token:T.token,body:{full_name:`Collector ${T.tag}`,username,password:PASSWORD}}),201,'collector');
  const list=expectStatus(await ctx.call('GET','/api/owner/collector',{token:T.token}),200);
  const row=list.collectors.find(c=>c.username===username);
  return {username,userId:user.id,id:row.id,token:await ctx.login(username)};
}
async function generateBill(ctx,token,body,{role='owner',status=201}={}){
  return expectStatus(await ctx.call('POST',`/api/${role}/bills`,{token,body}),status,`generate bill ${JSON.stringify(body)}`);
}
const uploadFiles=()=>fs.existsSync(uploadDir)?fs.readdirSync(uploadDir):[];
module.exports={db,uid,num,PASSWORD,DEMO_PASSWORD,uploadDir,uploadFiles,startServer,stopServer,expectStatus,setPrice,createTenant,createSubscriber,createSubscriberAccount,createCollector,generateBill};
