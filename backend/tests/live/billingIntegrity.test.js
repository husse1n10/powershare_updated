'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const h=require('./helpers');
let ctx,T,C;
before(async()=>{ctx=await h.startServer();T=await h.createTenant(ctx,'bil',{months:[[1,2026],[2,2026],[3,2026],[4,2026],[5,2026]]});C=await h.createCollector(ctx,T);});
after(()=>h.stopServer(ctx));

test('QA-LIVE-BILL-001 (DEF-051) metered invoice is generated, viewable by owner/collector/subscriber, and notifies the subscriber',async()=>{
  const sub=await h.createSubscriber(ctx,T);const acct=await h.createSubscriberAccount(ctx,T,sub);
  const bill=await h.generateBill(ctx,T.token,{subscription_id:sub.subscription_id,month:1,year:2026,current_reading:1100});
  assert.equal(h.num(bill.kwh_used),100);assert.equal(h.num(bill.total_ttc_lbp),1000000);assert.equal(h.num(bill.amount_due_usd),11.11);assert.equal(bill.status,'unpaid');
  const owner=h.expectStatus(await ctx.call('GET',`/api/owner/bills/${bill.id}`,{token:T.token}),200,'owner view');
  assert.equal(h.num(owner.bill.prev_reading),1000);assert.equal(h.num(owner.bill.current_reading),1100);
  h.expectStatus(await ctx.call('GET',`/api/collector/bills/${bill.id}`,{token:C.token}),200,'collector view');
  h.expectStatus(await ctx.call('GET',`/api/subscriber/bills/${bill.id}`,{token:acct.token}),200,'subscriber view');
  const n=h.expectStatus(await ctx.call('GET','/api/notifications',{token:acct.token}),200);
  assert.ok(n.items.some(x=>x.type==='bill'&&x.message.includes(bill.invoice_number)),'subscriber received New invoice notification');
});

test('QA-LIVE-BILL-002 (DEF-054) metered invoice with no monthly price at or before the period is rejected and leaves no reading behind',async()=>{
  const sub=await h.createSubscriber(ctx,T);
  const r=await ctx.call('POST','/api/owner/bills',{token:T.token,body:{subscription_id:sub.subscription_id,month:12,year:2025,current_reading:1150}});
  assert.equal(r.status,422);assert.equal(r.data.code,'MONTHLY_PRICING_REQUIRED');
  const readings=h.expectStatus(await ctx.call('GET',`/api/owner/subscriptions/${sub.subscription_id}/readings`,{token:T.token}),200);
  assert.equal(readings.length,0);
});

test('QA-LIVE-BILL-003 (DEF-055) consumption always uses the stored previous reading; a mismatching client value is rejected',async()=>{
  const sub=await h.createSubscriber(ctx,T);
  h.expectStatus(await ctx.call('POST','/api/owner/meter-readings',{token:T.token,body:{subscription_id:sub.subscription_id,reading_value:1100,reading_date:'2026-01-20'}}),200);
  const forged=await ctx.call('POST','/api/collector/bills',{token:C.token,body:{subscription_id:sub.subscription_id,month:2,year:2026,current_reading:1300,previous_reading:1290}});
  assert.equal(forged.status,409);assert.equal(forged.data.code,'PREVIOUS_READING_MISMATCH');assert.equal(forged.data.details.stored_previous_reading,1100);
  const inflated=await ctx.call('POST','/api/owner/bills',{token:T.token,body:{subscription_id:sub.subscription_id,month:2,year:2026,current_reading:1300,previous_reading:0}});
  assert.equal(inflated.status,409);
  const bill=await h.generateBill(ctx,T.token,{subscription_id:sub.subscription_id,month:2,year:2026,current_reading:1300,previous_reading:1100});
  assert.equal(h.num(bill.kwh_used),200);
  const lower=await ctx.call('POST','/api/owner/bills',{token:T.token,body:{subscription_id:sub.subscription_id,month:3,year:2026,current_reading:1250}});
  assert.equal(lower.status,422);assert.equal(lower.data.code,'INVALID_METER_READING');
  const readings=h.expectStatus(await ctx.call('GET',`/api/owner/subscriptions/${sub.subscription_id}/readings`,{token:T.token}),200);
  assert.equal(readings.length,2);assert.equal(h.num(readings[0].previous_value),1100);
});

test('QA-LIVE-BILL-004 (DEF-056) one meter reading cannot be billed in two periods',async()=>{
  const sub=await h.createSubscriber(ctx,T);
  const reading=h.expectStatus(await ctx.call('POST','/api/owner/meter-readings',{token:T.token,body:{subscription_id:sub.subscription_id,reading_value:1200,reading_date:'2026-02-25'}}),200);
  const first=await h.generateBill(ctx,T.token,{subscription_id:sub.subscription_id,month:2,year:2026,meter_reading_id:reading.id});
  assert.equal(h.num(first.kwh_used),200);
  const second=await ctx.call('POST','/api/owner/bills',{token:T.token,body:{subscription_id:sub.subscription_id,month:3,year:2026,meter_reading_id:reading.id}});
  assert.equal(second.status,409);assert.equal(second.data.code,'READING_ALREADY_BILLED');
});

test('QA-LIVE-BILL-005 (DEF-059) zero-amount invoice is settled at creation and is not left open',async()=>{
  const sub=await h.createSubscriber(ctx,T);
  const bill=await h.generateBill(ctx,T.token,{subscription_id:sub.subscription_id,month:1,year:2026,current_reading:1000});
  assert.equal(bill.status,'paid');assert.equal(h.num(bill.remaining_balance_lbp),0);assert.ok(bill.paid_at);
  const pay=await ctx.call('PUT',`/api/owner/bills/${bill.id}/pay`,{token:T.token,body:{}});
  assert.equal(pay.status,409);
});

test('QA-LIVE-BILL-006 historical invoice keeps its price and exchange rate after pricing and rate changes',async()=>{
  const sub=await h.createSubscriber(ctx,T);
  const bill=await h.generateBill(ctx,T.token,{subscription_id:sub.subscription_id,month:4,year:2026,current_reading:1100});
  await h.setPrice(ctx,T,4,2026,{price:99999,rate:100000});
  h.expectStatus(await ctx.call('PUT','/api/owner/settings',{token:T.token,body:{usd_lbp_rate:120000}}),200);
  const after=h.expectStatus(await ctx.call('GET',`/api/owner/bills/${bill.id}`,{token:T.token}),200).bill;
  for(const k of ['total_ttc_lbp','usd_lbp_rate','amount_due_lbp','amount_due_usd','base_amount_lbp'])assert.equal(after[k],bill[k],k);
  assert.equal(h.num(after.usd_lbp_rate),90000);
  h.expectStatus(await ctx.call('PUT','/api/owner/settings',{token:T.token,body:{usd_lbp_rate:90000}}),200);
});

test('QA-LIVE-BILL-007 fixed-amount subscriber is billed USD x period rate with no VAT/maintenance and no reading',async()=>{
  const sub=await h.createSubscriber(ctx,T,{fixedUsd:25});
  const bill=await h.generateBill(ctx,T.token,{subscription_id:sub.subscription_id,month:5,year:2026});
  assert.equal(h.num(bill.total_ttc_lbp),2250000);assert.equal(h.num(bill.total_usd),25);assert.equal(h.num(bill.vat_amount_lbp),0);assert.equal(h.num(bill.maintenance_lbp),0);
  const dup=await ctx.call('POST','/api/owner/bills',{token:T.token,body:{subscription_id:sub.subscription_id,month:5,year:2026}});
  assert.equal(dup.status,409);assert.equal(dup.data.code,'BILL_EXISTS');
  const noPricing=await h.generateBill(ctx,T.token,{subscription_id:sub.subscription_id,month:12,year:2025});
  assert.equal(h.num(noPricing.total_usd),25,'fixed billing does not require monthly pricing');
});

test('QA-LIVE-BILL-008 (DEF-072) monthly price carries forward; pricing view and period filter match the Owner Bills UI contract',async()=>{
  const sub=await h.createSubscriber(ctx,T);
  const bill=await h.generateBill(ctx,T.token,{subscription_id:sub.subscription_id,month:7,year:2026,current_reading:1100});
  assert.equal(h.num(bill.total_ttc_lbp),1000000,'July uses the May price (latest earlier monthly price)');
  const view=h.expectStatus(await ctx.call('GET','/api/owner/plan-pricing-rules?month=7&year=2026',{token:T.token}),200);
  const row=view.plans.find(p=>p.plan_id===T.plan.id);
  assert.equal(row.pricing_source,'carry_forward');assert.equal(row.source_month,5);assert.equal(h.num(row.base_cost_below_lbp),10000);assert.equal(row.is_custom,false);
  const may=h.expectStatus(await ctx.call('GET','/api/owner/plan-pricing-rules?month=5&year=2026',{token:T.token}),200).plans.find(p=>p.plan_id===T.plan.id);
  assert.equal(may.pricing_source,'period_custom');
  const early=h.expectStatus(await ctx.call('GET','/api/owner/plan-pricing-rules?month=12&year=2025',{token:T.token}),200).plans.find(p=>p.plan_id===T.plan.id);
  assert.equal(early.pricing_source,'default');
  const july=h.expectStatus(await ctx.call('GET','/api/owner/bills?month=7&year=2026',{token:T.token}),200);
  assert.ok(july.length>=1&&july.every(b=>b.month===7&&b.year===2026));
  const open=h.expectStatus(await ctx.call('GET','/api/collector/bills?status=unpaid',{token:C.token}),200);
  assert.ok(open.length>=1&&open.every(b=>['unpaid','partially_paid'].includes(b.status)));
  const subs=h.expectStatus(await ctx.call('GET','/api/owner/subscribers',{token:T.token}),200);
  assert.ok(subs.every(x=>x.sub_active===x.subscription_active),'sub_active field used by the UI is present');
});
