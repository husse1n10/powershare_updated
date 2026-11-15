'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const h=require('./helpers');
let ctx,T,sub,meter;
before(async()=>{ctx=await h.startServer();T=await h.createTenant(ctx,'upl',{months:[[1,2026]]});meter=`PS${String(Date.now()).slice(-6)}`;sub=await h.createSubscriber(ctx,T,{meter});});
after(()=>h.stopServer(ctx));
function form(buffer,type,name,fields={}){const fd=new FormData();for(const [k,v] of Object.entries(fields))fd.append(k,String(v));if(buffer)fd.append('photo',new Blob([buffer],{type}),name);return fd;}
const scan=fd=>ctx.call('POST','/api/owner/meter-readings/scan',{token:T.token,form:fd});
const meterImage=(lines)=>sharp(Buffer.from(`<svg width="640" height="220" xmlns="http://www.w3.org/2000/svg"><rect width="640" height="220" fill="white"/>${lines.map((l,i)=>`<text x="20" y="${80+i*80}" font-size="40" font-family="monospace">${l}</text>`).join('')}</svg>`)).png().toBuffer();

test('QA-LIVE-UP-001 unsupported, disguised, oversized and missing uploads are rejected with 422 and leave no files',async()=>{
  const gif=Buffer.from('R0lGODlhAQABAAAAACw=','base64');
  let r=await scan(form(gif,'image/gif','a.gif'));assert.equal(r.status,422);assert.equal(r.data.code,'INVALID_IMAGE_TYPE');
  r=await scan(form(Buffer.from('<?php echo 1; ?>'),'image/png','evil.png'));assert.equal(r.status,422,'DEF-065');assert.equal(r.data.code,'INVALID_IMAGE');
  r=await scan(form(Buffer.alloc(9*1024*1024,1),'image/jpeg','big.jpg'));assert.equal(r.status,422);assert.equal(r.data.code,'UPLOAD_VALIDATION_ERROR');
  r=await scan(form(null));assert.equal(r.status,422);assert.equal(r.data.code,'METER_IMAGE_REQUIRED');
  assert.deepEqual(h.uploadFiles(),[]);
});

test('QA-LIVE-UP-002 (DEF-067) OCR reads meter number and reading offline, identifies the subscriber, requires confirmation and deletes the photo',async()=>{
  const r=await scan(form(await meterImage([`METER NO: ${meter}`,'KWH: 01580.5']),'image/png','meter.png'));
  assert.equal(r.status,200,JSON.stringify(r.data));
  assert.equal(r.data.ocr.meterNumber,meter);assert.equal(r.data.ocr.readingValue,1580.5);
  assert.equal(r.data.subscriber.subscription_id,sub.subscription_id);assert.equal(r.data.requires_confirmation,true);
  assert.deepEqual(h.uploadFiles(),[],'temporary OCR files are deleted');
  const readings=h.expectStatus(await ctx.call('GET',`/api/owner/subscriptions/${sub.subscription_id}/readings`,{token:T.token}),200);
  assert.equal(readings.length,0,'scanning alone never saves a reading');
});

test('QA-LIVE-UP-003 (DEF-066) a rejected reading does not keep its photo; an accepted one is stored privately',async()=>{
  const png=await meterImage(['KWH: 500']);
  let r=await ctx.call('POST','/api/owner/meter-readings',{token:T.token,form:form(png,'image/png','m.png',{subscription_id:sub.subscription_id,reading_value:500})});
  assert.equal(r.status,422);assert.equal(r.data.code,'INVALID_METER_READING');
  await new Promise(res=>setTimeout(res,200));assert.deepEqual(h.uploadFiles(),[]);
  r=await ctx.call('POST','/api/owner/meter-readings',{token:T.token,form:form(png,'image/png','m.png',{subscription_id:sub.subscription_id,reading_value:1050})});
  assert.equal(r.status,200);
  const files=h.uploadFiles();assert.equal(files.length,1);
  // Never downloadable: anonymously (404/401) nor with a valid token (no static upload route exists).
  for(const url of [`/uploads/${files[0]}`,`/uploads/meters/${files[0]}`,`/api/uploads/${files[0]}`]){
    assert.ok([401,404].includes((await ctx.call('GET',url)).status),url);
    assert.equal((await ctx.call('GET',url,{token:T.token})).status,404,`${url} (authenticated)`);
  }
});

test('QA-LIVE-UPD-001 (DEF-060) monthly pricing accepts omitted optional fields and partial updates keep stored values',async()=>{
  let p=h.expectStatus(await ctx.call('PUT','/api/owner/plan-pricing-rules',{token:T.token,body:{plan_id:T.plan.id,month:6,year:2026,base_cost_below_lbp:12000}}),200);
  assert.equal(h.num(p.threshold_kwh),100);assert.equal(h.num(p.base_cost_above_lbp),12000);assert.equal(h.num(p.maintenance_lbp),0);assert.equal(h.num(p.usd_lbp_rate),90000);
  p=h.expectStatus(await ctx.call('PUT','/api/owner/plan-pricing-rules',{token:T.token,body:{plan_id:T.plan.id,month:6,year:2026,maintenance_lbp:5000}}),200);
  assert.equal(h.num(p.base_cost_below_lbp),12000);assert.equal(h.num(p.maintenance_lbp),5000);
  assert.equal((await ctx.call('DELETE',`/api/owner/plan-pricing-rules/${T.plan.id}?month=7&year=2026`,{token:T.token})).status,404);
});

test('QA-LIVE-UPD-002 (DEF-060) main meter partial updates do not fail or reset other fields',async()=>{
  const mm=h.expectStatus(await ctx.call('POST','/api/owner/main-meters',{token:T.token,body:{meter_number:`MMU${h.uid()}`,initial_kwh:5000}}),201);
  let r=h.expectStatus(await ctx.call('PUT',`/api/owner/main-meters/${mm.id}`,{token:T.token,body:{initial_kwh:6000}}),200);
  assert.equal(r.meter_number,mm.meter_number);assert.equal(h.num(r.initial_kwh),6000);
  r=h.expectStatus(await ctx.call('PUT',`/api/owner/main-meters/${mm.id}`,{token:T.token,body:{meter_number:`${mm.meter_number}X`}}),200);
  assert.equal(h.num(r.initial_kwh),6000);
});

test('assigned collector can recognize and confirm OCR; unassigned subscriber remains forbidden',async()=>{
  const number='QC'+String(Date.now()).slice(-7);
  const own=await h.createSubscriber(ctx,T,{meter:number,initial:1000});
  const collector=await h.createCollector(ctx,T);
  h.expectStatus(await ctx.call('PUT',`/api/owner/collector/${collector.id}/assignments`,{token:T.token,body:{subscriber_ids:[own.subscriber_id],generator_ids:[]}}),200);
  const list=h.expectStatus(await ctx.call('GET','/api/collector/subscribers',{token:collector.token}),200);
  assert.ok(list.some(s=>s.subscriber_id===own.subscriber_id));
  const png=await meterImage([`METER NO: ${number}`,'KWH: 01580.5']);
  const preview=h.expectStatus(await ctx.call('POST','/api/collector/meter-readings/scan',{token:collector.token,form:form(png,'image/png','meter.png')}),200);
  assert.equal(preview.subscriber.subscriber_id,own.subscriber_id);
  assert.equal(preview.ocr.readingValue,1580.5);
  const bill=await h.generateBill(ctx,collector.token,{subscription_id:own.subscription_id,month:1,year:2026,current_reading:1581,reading_date:'2026-01-20',ocr_confirmed:true,ocr:preview.ocr},{role:'collector'});
  const [reading]=await h.db.query('SELECT * FROM meter_readings WHERE id=?',[bill.meter_reading_id]);
  assert.equal(Number(reading.reading_value),1581);assert.equal(Number(reading.ocr_reading_value),1580.5);assert.equal(reading.ocr_confirmed,1);
  const other=await h.createSubscriber(ctx,T,{meter:'UN'+number});
  const denied=await ctx.call('POST','/api/collector/meter-readings/scan',{token:collector.token,form:form(await meterImage([`METER NO: UN${number}`,'KWH: 01580.5']),'image/png','other.png')});
  assert.equal(denied.status,403);assert.equal(denied.data.code,'NOT_ASSIGNED');
});
