'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const h=require('./helpers');
let ctx,T;const s={};
before(async()=>{ctx=await h.startServer();T=await h.createTenant(ctx,'cmb',{months:[[6,2026],[7,2026],[8,2026],[9,2026],[10,2026]]});});
after(()=>h.stopServer(ctx));
const bill=(sub,month,current)=>h.generateBill(ctx,T.token,{subscription_id:sub.subscription_id,month,year:2026,current_reading:current});
const pay=(id,body={})=>ctx.call('PUT',`/api/owner/bills/${id}/pay`,{token:T.token,body});
const getBill=async id=>h.expectStatus(await ctx.call('GET',`/api/owner/bills/${id}`,{token:T.token}),200).bill;

test('QA-LIVE-FIN-001 (DEF-052) invoices with payments cannot be combined (prevents double charging)',async()=>{
  const sub=await h.createSubscriber(ctx,T);
  s.aug=await bill(sub,8,1100);s.jul=await bill(sub,7,1200);
  h.expectStatus(await pay(s.jul.id,{amount_lbp:400000}),200);
  const r=await ctx.call('POST','/api/owner/bills/combine',{token:T.token,body:{bill_ids:[s.aug.id,s.jul.id]}});
  assert.equal(r.status,422);assert.equal(r.data.code,'COMBINE_HAS_PAYMENTS');
  assert.equal((await getBill(s.aug.id)).status,'unpaid');
  const jul=await getBill(s.jul.id);assert.equal(jul.status,'partially_paid');assert.equal(h.num(jul.remaining_balance_lbp),600000);
});

test('QA-LIVE-FIN-002 combining unpaid invoices keeps due = received + remaining and collects exactly the billed total',async()=>{
  const sub=await h.createSubscriber(ctx,T);
  const aug=await bill(sub,8,1100),jul=await bill(sub,7,1200);
  const c=h.expectStatus(await ctx.call('POST','/api/owner/bills/combine',{token:T.token,body:{bill_ids:[jul.id,aug.id]}}),200);
  assert.equal(c.id,aug.id,'newest invoice is the combined invoice');
  assert.equal(h.num(c.amount_due_lbp),2000000);assert.equal(h.num(c.amount_received_lbp),0);assert.equal(h.num(c.remaining_balance_lbp),2000000);
  assert.equal((await getBill(jul.id)).status,'waived');
  assert.equal((await pay(jul.id,{amount_lbp:1000})).status,409,'merged invoice is not payable');
  const p=h.expectStatus(await pay(c.id),200);assert.equal(p.status,'paid');
  const [row]=await h.db.query('SELECT SUM(amount_lbp) total FROM payments WHERE bill_id IN (?,?)',[aug.id,jul.id]);
  assert.equal(h.num(row.total),2000000);
  assert.equal((await getBill(c.id)).combined_items.length,2);
  s.combined=c;s.merged=jul;
});

test('QA-LIVE-FIN-003 (DEF-058) period reports do not count merged invoices twice',async()=>{
  const m7=h.expectStatus(await ctx.call('GET','/api/owner/reports/summary?month=7&year=2026',{token:T.token}),200).billing;
  const m8=h.expectStatus(await ctx.call('GET','/api/owner/reports/summary?month=8&year=2026',{token:T.token}),200).billing;
  // 4 invoices x 1,000,000 were issued. July: FIN-001 July only (FIN-002 July is inside the combined August invoice).
  assert.equal(h.num(m7.current_charges_lbp),1000000);assert.equal(h.num(m8.current_charges_lbp),3000000);
  assert.equal(h.num(m7.consumption_kwh)+h.num(m8.consumption_kwh),400);
});

test('QA-LIVE-FIN-004 (DEF-053) deleting an invoice that carried a balance restores the earlier debt',async()=>{
  const sub=await h.createSubscriber(ctx,T);
  const sep=await bill(sub,9,1100);h.expectStatus(await pay(sep.id,{amount_lbp:250000}),200);
  const oct=await bill(sub,10,1150);
  assert.equal(h.num(oct.previous_balance_lbp),750000);assert.equal(h.num(oct.amount_due_lbp),1250000);
  assert.equal((await getBill(sep.id)).status,'carried_forward');
  h.expectStatus(await ctx.call('DELETE',`/api/owner/bills/${oct.id}`,{token:T.token}),200);
  const restored=await getBill(sep.id);
  assert.equal(restored.status,'partially_paid');assert.equal(restored.carried_forward_to_bill_id,null);assert.equal(h.num(restored.remaining_balance_lbp),750000);
  const subs=h.expectStatus(await ctx.call('GET','/api/owner/subscribers',{token:T.token}),200);
  assert.equal(h.num(subs.find(x=>x.subscription_id===sub.subscription_id).outstanding_lbp),750000);
  assert.equal(h.expectStatus(await pay(sep.id),200).status,'paid');
});

test('QA-LIVE-FIN-005 invoices that other invoices depend on cannot be deleted',async()=>{
  const sub=await h.createSubscriber(ctx,T);
  const sep=await bill(sub,9,1100);await bill(sub,10,1200);
  for(const [id,why] of [[sep.id,'carried-forward source'],[s.combined.id,'combined invoice'],[s.merged.id,'merged invoice'],[s.jul.id,'invoice with payments']]){
    const r=await ctx.call('DELETE',`/api/owner/bills/${id}`,{token:T.token});
    assert.equal(r.status,409,why);assert.equal(r.data.code,'BILL_DELETE_BLOCKED',why);
  }
});
