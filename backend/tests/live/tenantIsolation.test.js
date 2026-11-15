'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const h=require('./helpers');
let ctx,A,B;const a={},b={};
before(async()=>{
  ctx=await h.startServer();
  A=await h.createTenant(ctx,'isa',{months:[[1,2026]]});B=await h.createTenant(ctx,'isb',{months:[[1,2026]]});
  for(const [T,o] of [[A,a],[B,b]]){
    o.sub=await h.createSubscriber(ctx,T);o.sub2=await h.createSubscriber(ctx,T);
    o.acct=await h.createSubscriberAccount(ctx,T,o.sub);o.col=await h.createCollector(ctx,T);
    o.bill=await h.generateBill(ctx,T.token,{subscription_id:o.sub.subscription_id,month:1,year:2026,current_reading:1100});
    o.outage=h.expectStatus(await ctx.call('POST','/api/owner/outages',{token:T.token,body:{generator_id:T.generator.id,schedule_type:'recurring',day_of_week:2,start_time:'10:00',end_time:'12:00',notes:`Outage ${T.tag}`}}),201);
  }
  h.expectStatus(await ctx.call('PUT',`/api/collector/bills/${b.bill.id}/pay`,{token:b.col.token,body:{amount_lbp:100000}}),200);
  b.settlement=h.expectStatus(await ctx.call('POST','/api/collector/settlements/request',{token:b.col.token,body:{amount_lbp:50000}}),201);
});
after(()=>h.stopServer(ctx));

test('QA-LIVE-SEC-001 owner cannot modify any resource of another owner (IDOR) and the other tenant stays intact',async()=>{
  const p=`/api/owner`;const otime={schedule_type:'recurring',day_of_week:1,start_time:'09:00',end_time:'10:00'};
  const attempts=[
    ['PUT',`${p}/generators/${B.generator.id}`,{name:'Hacked'}],['DELETE',`${p}/generators/${B.generator.id}`],
    ['PUT',`${p}/main-meters/${B.mainMeter.id}`,{meter_number:'HACK'}],['DELETE',`${p}/main-meters/${B.mainMeter.id}`],
    ['PUT',`${p}/plans/${B.plan.id}`,{name:'Hacked'}],['DELETE',`${p}/plans/${B.plan.id}`],
    ['PUT',`${p}/plan-pricing-rules`,{plan_id:B.plan.id,month:1,year:2026,base_cost_below_lbp:1}],['DELETE',`${p}/plan-pricing-rules/${B.plan.id}?month=1&year=2026`],
    ['PUT',`${p}/subscribers/${b.sub.subscriber_id}`,{full_name:'Hacked Name'}],['POST',`${p}/subscribers/${b.sub2.subscriber_id}/account`,{username:`steal${h.uid()}`,password:'QaPass123!'}],
    ['DELETE',`${p}/subscriptions/${b.sub.subscription_id}`],['DELETE',`${p}/subscriptions/${b.sub2.subscription_id}/permanent`],['POST',`${p}/subscriptions/${b.sub.subscription_id}/resubscribe`,{}],
    ['POST',`${p}/meter-readings`,{subscription_id:b.sub.subscription_id,reading_value:5000}],['POST',`${p}/bills`,{subscription_id:b.sub2.subscription_id,month:1,year:2026,current_reading:1100}],
    ['PUT',`${p}/bills/${b.bill.id}/pay`,{amount_lbp:1000}],['DELETE',`${p}/bills/${b.bill.id}`],['POST',`${p}/bills/${b.bill.id}/remind`],['POST',`${p}/bills/combine`,{bill_ids:[b.bill.id,a.bill.id]}],
    ['PUT',`${p}/collector/${b.col.id}`,{full_name:'Hacked'}],['DELETE',`${p}/collector/${b.col.id}`],['PUT',`${p}/collector/${b.col.id}/assignments`,{generator_ids:[B.generator.id]}],
    ['PUT',`${p}/collector/${a.col.id}/assignments`,{generator_ids:[B.generator.id],subscriber_ids:[b.sub.subscriber_id]}],
    ['PUT',`${p}/collector/settlements/${b.settlement.id}/confirm`,{}],['PUT',`${p}/collector/settlements/${b.settlement.id}/reject`,{}],
    ['POST',`${p}/outages`,{generator_id:B.generator.id,outage_date:'2026-11-01',...otime,schedule_type:'one_time'}],['PUT',`${p}/outages/${b.outage.id}`,{generator_id:B.generator.id,...otime}],['DELETE',`${p}/outages/${b.outage.id}`],
    ['POST',`${p}/subscribers/create`,{full_name:'X Y',location_address:'z',plan_id:B.plan.id}],['POST',`${p}/subscribers/create`,{full_name:'X Y',location_address:'z',plan_id:A.plan.id,main_meter_id:B.mainMeter.id}],
  ];
  const failures=[];
  for(const [m,u,body] of attempts){const r=await ctx.call(m,u,{token:A.token,body});if(![403,404].includes(r.status))failures.push(`${m} ${u} -> ${r.status}`);}
  assert.deepEqual(failures,[],'every cross-tenant attempt must be rejected');
  const [g]=await h.db.query('SELECT name,is_active FROM generators WHERE id=?',[B.generator.id]);assert.deepEqual({...g},{name:'Gen isb',is_active:1});
  const [mm]=await h.db.query('SELECT meter_number,is_active FROM owner_main_meters WHERE id=?',[B.mainMeter.id]);assert.equal(mm.is_active,1);assert.notEqual(mm.meter_number,'HACK');
  const [pl]=await h.db.query('SELECT name,is_active FROM plans WHERE id=?',[B.plan.id]);assert.deepEqual({...pl},{name:'10A',is_active:1});
  const [pr]=await h.db.query('SELECT base_cost_below_lbp FROM plan_monthly_pricing WHERE plan_id=? AND month=1 AND year=2026',[B.plan.id]);assert.equal(h.num(pr.base_cost_below_lbp),10000);
  const [sp]=await h.db.query('SELECT sp.full_name,s.is_active,sp2.user_id u2 FROM subscriber_profiles sp JOIN subscriptions s ON s.subscriber_id=sp.id JOIN subscriber_profiles sp2 ON sp2.id=? WHERE sp.id=?',[b.sub2.subscriber_id,b.sub.subscriber_id]);
  assert.notEqual(sp.full_name,'Hacked Name');assert.equal(sp.is_active,1);assert.equal(sp.u2,null);
  const [bl]=await h.db.query('SELECT amount_received_lbp,status FROM bills WHERE id=?',[b.bill.id]);assert.equal(h.num(bl.amount_received_lbp),100000);
  const [st]=await h.db.query('SELECT status FROM collector_settlements WHERE id=?',[b.settlement.id]);assert.equal(st.status,'pending');
  const [ou]=await h.db.query('SELECT is_active,start_time FROM outage_schedules WHERE id=?',[b.outage.id]);assert.equal(ou.is_active,1);assert.equal(ou.start_time,'10:00:00');
  const assigned=await h.db.query('SELECT COUNT(*) n FROM collector_generator_assignments WHERE collector_id IN (?,?)',[a.col.id,b.col.id]);assert.equal(h.num(assigned[0].n),0);
});

test('QA-LIVE-SEC-002 (DEF-061) rejected cross-tenant actions leave no false audit entries',async()=>{
  const [r]=await h.db.query(`SELECT COUNT(*) n FROM audit_logs WHERE user_id=? AND action IN ('GENERATOR_DEACTIVATED','MAIN_METER_DEACTIVATED','SUBSCRIPTION_DEACTIVATED','COLLECTOR_ASSIGNMENTS_UPDATED','MONTHLY_PRICING_REMOVED','OUTAGE_DEACTIVATED','BILL_DELETED','SETTLEMENT_CONFIRMED','SETTLEMENT_REJECTED')`,[A.userId]);
  assert.equal(h.num(r.n),0);
});

test('QA-LIVE-SEC-003 owner and collector cannot read another tenant\'s data',async()=>{
  assert.equal((await ctx.call('GET',`/api/owner/bills/${b.bill.id}`,{token:A.token})).status,404);
  assert.equal((await ctx.call('GET',`/api/owner/subscriptions/${b.sub.subscription_id}/readings`,{token:A.token})).status,404);
  assert.deepEqual(h.expectStatus(await ctx.call('GET',`/api/owner/generators/${B.generator.id}/outages`,{token:A.token}),200),[]);
  const ids=h.expectStatus(await ctx.call('GET','/api/owner/bills',{token:A.token}),200).map(x=>x.id);assert.ok(!ids.includes(b.bill.id));
  for(const [m,u,body] of [['GET',`/api/collector/bills/${b.bill.id}`],['PUT',`/api/collector/bills/${b.bill.id}/pay`,{amount_lbp:1000}],['GET',`/api/collector/subscriptions/${b.sub.subscription_id}/readings`],['POST','/api/collector/bills',{subscription_id:b.sub2.subscription_id,month:1,year:2026,current_reading:1100}],['POST','/api/collector/meter-readings',{subscription_id:b.sub.subscription_id,reading_value:5000}]])
    assert.ok([403,404].includes((await ctx.call(m,u,{token:a.col.token,body})).status),`${m} ${u}`);
  const colBills=h.expectStatus(await ctx.call('GET','/api/collector/bills',{token:a.col.token}),200).map(x=>x.id);assert.ok(!colBills.includes(b.bill.id));
});

test('QA-LIVE-SEC-004 collector assigned to one generator cannot reach subscribers of the owner\'s other generator',async()=>{
  const g2=h.expectStatus(await ctx.call('POST','/api/owner/generators',{token:A.token,body:{name:'Gen isa 2',location_name:'Tyre'}}),201);
  const plan2=h.expectStatus(await ctx.call('POST','/api/owner/plans',{token:A.token,body:{generator_id:g2.id,name:'5A',ampere:5,maintenance_lbp:0}}),201);
  await h.setPrice(ctx,A,1,2026,{plan:plan2});
  const sub=await h.createSubscriber(ctx,A,{plan:plan2});
  const other=await h.generateBill(ctx,A.token,{subscription_id:sub.subscription_id,month:1,year:2026,current_reading:1100});
  h.expectStatus(await ctx.call('PUT',`/api/owner/collector/${a.col.id}/assignments`,{token:A.token,body:{generator_ids:[A.generator.id]}}),200);
  const bills=h.expectStatus(await ctx.call('GET','/api/collector/bills',{token:a.col.token}),200).map(x=>x.id);
  assert.ok(bills.includes(a.bill.id));assert.ok(!bills.includes(other.id));
  assert.equal((await ctx.call('GET',`/api/collector/bills/${other.id}`,{token:a.col.token})).status,403);
  assert.equal((await ctx.call('PUT',`/api/collector/bills/${other.id}/pay`,{token:a.col.token,body:{}})).status,403);
});

test('QA-LIVE-SEC-005 subscriber sees only own invoices, payments and generator outages',async()=>{
  assert.equal((await ctx.call('GET',`/api/subscriber/bills/${b.bill.id}`,{token:a.acct.token})).status,404);
  assert.equal((await ctx.call('POST',`/api/subscriber/bills/${b.bill.id}/simulated-payment`,{token:a.acct.token,body:{amount_lbp:1000}})).status,404);
  assert.deepEqual(h.expectStatus(await ctx.call('GET','/api/subscriber/bills',{token:a.acct.token}),200).map(x=>x.id),[a.bill.id]);
  assert.deepEqual(h.expectStatus(await ctx.call('GET','/api/subscriber/payments',{token:a.acct.token}),200),[]);
  assert.deepEqual(h.expectStatus(await ctx.call('GET','/api/subscriber/outages',{token:a.acct.token}),200).map(x=>x.notes),['Outage isa']);
});

test('QA-LIVE-SEC-006 role-based access control blocks every cross-role endpoint',async()=>{
  const matrix=[[A.token,'GET','/api/admin/users'],[A.token,'PUT','/api/admin/settings/platform_name'],[a.col.token,'GET','/api/admin/dashboard'],[a.acct.token,'GET','/api/owner/dashboard'],
    [a.acct.token,'GET','/api/collector/bills'],[a.col.token,'GET','/api/owner/subscribers'],[A.token,'GET','/api/collector/wallet'],[A.token,'GET','/api/subscriber/bills'],[ctx.adminToken,'GET','/api/owner/dashboard'],
    [a.acct.token,'PUT',`/api/support/tickets/1/status`]];
  for(const [tok,m,u] of matrix){const r=await ctx.call(m,u,{token:tok,body:m==='GET'?undefined:{value:'x',status:'closed'}});assert.ok([403,404].includes(r.status)&&r.status!==200,`${m} ${u} -> ${r.status}`);}
  assert.equal((await ctx.call('GET','/api/admin/users')).status,401);
});

test('QA-LIVE-SEC-007 self-registration creates a pending request without claiming existing subscriber profiles',async()=>{
  const body={full_name:'New applicant',username:'reg'+h.uid(),password:'QaPass123!',phone:a.sub2.phone,generator_id:A.generator.id,location_address:'Main street'};
  const ok=h.expectStatus(await ctx.call('POST','/api/auth/register',{body}),201);
  assert.equal(ok.application.status,'unselected');
  const token=await ctx.login(body.username,body.password);
  h.expectStatus(await ctx.call('POST','/api/subscriber/registration-application',{token,body:{generator_id:A.generator.id,location_address:'Main street'}}),201);
  const [link]=await h.db.query('SELECT user_id FROM subscriber_profiles WHERE id=?',[a.sub2.subscriber_id]);assert.equal(link.user_id,null);
  const bad=await ctx.call('POST','/api/auth/register',{body:{...body,username:'bad'+h.uid(),meter_number:a.sub2.meter_number}});
  assert.equal(bad.status,422);assert.equal(bad.data.code,'METER_ASSIGNMENT_STAFF_ONLY');
});

test('QA-LIVE-SEC-008 SQL injection payloads are treated as data',async()=>{
  const r=h.expectStatus(await ctx.call('GET',`/api/admin/users?search=${encodeURIComponent("' OR 1=1 -- ")}`,{token:ctx.adminToken}),200);
  assert.equal(r.total,0);
  assert.equal((await ctx.call('POST','/api/auth/login',{body:{username:"admin' -- ",password:'x'}})).status,401);
});
