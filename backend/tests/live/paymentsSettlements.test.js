'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const h=require('./helpers');
let ctx,T,C;
before(async()=>{ctx=await h.startServer();T=await h.createTenant(ctx,'pay',{months:[[1,2026],[2,2026],[3,2026]]});C=await h.createCollector(ctx,T);});
after(()=>h.stopServer(ctx));
const newBill=async(kwh,month=1)=>{const sub=await h.createSubscriber(ctx,T);return h.generateBill(ctx,T.token,{subscription_id:sub.subscription_id,month,year:2026,current_reading:1000+kwh});};
const ownerPay=(id,body={})=>ctx.call('PUT',`/api/owner/bills/${id}/pay`,{token:T.token,body});
const paidTotal=async id=>{const [r]=await h.db.query("SELECT COUNT(*) n,COALESCE(SUM(amount_lbp),0) total FROM payments WHERE bill_id=? AND status='completed'",[id]);return {n:h.num(r.n),total:h.num(r.total)};};

test('QA-LIVE-PAY-001 overpayment is rejected; multiple LBP/USD partials settle exactly to the invoice total',async()=>{
  const bill=await newBill(33);assert.equal(h.num(bill.amount_due_lbp),330000);assert.equal(h.num(bill.amount_due_usd),3.67);
  assert.equal((await ownerPay(bill.id,{amount_lbp:330001})).data.code,'PAYMENT_EXCEEDS_BALANCE');
  assert.equal((await ownerPay(bill.id,{amount_usd:3.7})).data.code,'PAYMENT_EXCEEDS_BALANCE');
  const p1=h.expectStatus(await ownerPay(bill.id,{amount_lbp:100000}),200);assert.equal(p1.status,'partially_paid');assert.equal(p1.remainingBalanceLbp,230000);
  const p2=h.expectStatus(await ownerPay(bill.id,{amount_usd:1}),200);assert.equal(p2.remainingBalanceLbp,140000);assert.equal(p2.remainingBalanceUsd,1.56);
  const p3=h.expectStatus(await ownerPay(bill.id,{amount_usd:p2.remainingBalanceUsd}),200);assert.equal(p3.status,'paid');assert.equal(p3.paymentAmountLbp,140000);
  assert.equal((await ownerPay(bill.id,{amount_lbp:1})).data.code,'BILL_NOT_PAYABLE');
  assert.deepEqual(await paidTotal(bill.id),{n:3,total:330000});
});

test('QA-LIVE-PAY-002 concurrent full payments on one invoice record exactly one payment',async()=>{
  const bill=await newBill(50);
  const results=await Promise.all([1,2,3,4,5].map(()=>ownerPay(bill.id)));
  assert.equal(results.filter(r=>r.status===200).length,1,JSON.stringify(results.map(r=>r.status)));
  assert.ok(results.filter(r=>r.status!==200).every(r=>r.status===409));
  assert.deepEqual(await paidTotal(bill.id),{n:1,total:500000});
});

test('QA-LIVE-PAY-003 collector default collection uses the remaining balance of a partially paid invoice',async()=>{
  const bill=await newBill(100);
  h.expectStatus(await ownerPay(bill.id,{amount_lbp:300000}),200);
  const list=h.expectStatus(await ctx.call('GET','/api/collector/bills',{token:C.token}),200);
  assert.ok(list.some(b=>b.id===bill.id&&b.status==='partially_paid'),'partially paid invoice remains collectible');
  const p=h.expectStatus(await ctx.call('PUT',`/api/collector/bills/${bill.id}/pay`,{token:C.token,body:{}}),200);
  assert.equal(p.paymentAmountLbp,700000);assert.equal(p.status,'paid');
});

let wallet0;
test('QA-LIVE-SET-001 concurrent settlement requests can never exceed the collector balance',async()=>{
  const bill=await newBill(250,2);
  h.expectStatus(await ctx.call('PUT',`/api/collector/bills/${bill.id}/pay`,{token:C.token,body:{}}),200);
  wallet0=h.expectStatus(await ctx.call('GET','/api/collector/wallet',{token:C.token}),200).balance_lbp;
  assert.equal(wallet0,3200000);
  const results=await Promise.all([1,2,3,4].map(()=>ctx.call('POST','/api/collector/settlements/request',{token:C.token,body:{amount_lbp:1200000}})));
  assert.equal(results.filter(r=>r.status===201).length,2,JSON.stringify(results.map(r=>r.status)));
  assert.ok(results.filter(r=>r.status!==201).every(r=>r.data.code==='SETTLEMENT_REQUEST_CONFLICT'));
});

test('QA-LIVE-SET-002 a settlement is confirmed exactly once under concurrent approvals',async()=>{
  const pending=h.expectStatus(await ctx.call('GET','/api/owner/collector/settlements',{token:T.token}),200).filter(x=>x.status==='pending');
  const id=pending[0].id;
  const results=await Promise.all([1,2].map(()=>ctx.call('PUT',`/api/owner/collector/settlements/${id}/confirm`,{token:T.token,body:{}})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const [ledger]=await h.db.query("SELECT COUNT(*) n FROM collector_ledger WHERE settlement_id=? AND tx_type='owner_settlement'",[id]);
  assert.equal(h.num(ledger.n),1);
  const [notes]=await h.db.query("SELECT COUNT(*) n FROM notifications WHERE user_id=? AND type='settlement' AND title='Settlement confirmed'",[C.userId]);
  assert.equal(h.num(notes.n),1);
});

test('QA-LIVE-SET-003 rejection is idempotent-safe and a rejected request cannot be confirmed',async()=>{
  const pending=h.expectStatus(await ctx.call('GET','/api/owner/collector/settlements',{token:T.token}),200).filter(x=>x.status==='pending');
  const id=pending[0].id;
  h.expectStatus(await ctx.call('PUT',`/api/owner/collector/settlements/${id}/reject`,{token:T.token,body:{}}),200);
  assert.equal((await ctx.call('PUT',`/api/owner/collector/settlements/${id}/reject`,{token:T.token,body:{}})).data.code,'SETTLEMENT_NOT_PENDING');
  assert.equal((await ctx.call('PUT',`/api/owner/collector/settlements/${id}/confirm`,{token:T.token,body:{}})).data.code,'SETTLEMENT_NOT_PENDING');
});

test('QA-LIVE-SET-004 collector ledger: collected - transferred = remaining cash; over-settlement rejected',async()=>{
  const w=h.expectStatus(await ctx.call('GET','/api/collector/wallet',{token:C.token}),200);
  assert.equal(w.balance_lbp,wallet0-1200000);
  const over=await ctx.call('POST','/api/collector/settlements/request',{token:C.token,body:{amount_lbp:w.balance_lbp+1}});
  assert.equal(over.status,409);
  const totals=h.expectStatus(await ctx.call('GET','/api/owner/collector',{token:T.token}),200).totals;
  assert.equal(totals.collected_lbp,3200000);assert.equal(totals.transferred_lbp,1200000);assert.equal(totals.balance_lbp,2000000);
});

test('collector and owner wallet summaries expose reconciled totals and reserve pending cash',async()=>{
  const wallet=h.expectStatus(await ctx.call('GET','/api/collector/wallet',{token:C.token}),200);
  assert.equal(wallet.collected_lbp-wallet.transferred_lbp,wallet.pending_lbp+wallet.available_lbp);
  assert.equal(wallet.balance_lbp,wallet.collected_lbp-wallet.transferred_lbp);
  assert.equal(wallet.collected_lbp,3200000);assert.equal(wallet.transferred_lbp,1200000);
  const owner=h.expectStatus(await ctx.call('GET','/api/owner/collector',{token:T.token}),200);
  const row=owner.collectors.find(c=>c.id===C.id);
  for(const key of ['collected_lbp','transferred_lbp','balance_lbp','pending_lbp','available_lbp','pending_count'])assert.equal(row.wallet[key],wallet[key],key);
});
