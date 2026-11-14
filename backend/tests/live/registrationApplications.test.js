'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const h=require('./helpers');
let ctx,A,B;
before(async()=>{ctx=await h.startServer();A=await h.createTenant(ctx,'regA');B=await h.createTenant(ctx,'regB');});
after(()=>h.stopServer(ctx));
const requestBody=(patch={})=>({full_name:'New Subscriber',username:'reg'+h.uid(),password:h.PASSWORD,phone:'+96171123456',generator_id:A.generator.id,location_address:'Beirut, building 12',...patch});
async function apply(patch={}){
  const body=requestBody(patch);
  const user=h.expectStatus(await ctx.call('POST','/api/auth/register',{body}),201,'register without meter');
  const token=await ctx.login(body.username);
  return {body,user,token,id:user.application.id};
}
const assign=(a,body={},token=ctx.adminToken)=>ctx.call('PUT',`/api/admin/registration-applications/${a.id}/assign-meter`,{token,body:{plan_id:A.plan.id,meter_number:'M'+h.uid(),...body}});

test('QA-LIVE-REG-001 public destinations list contains available generators without user contact details',async()=>{
  const list=h.expectStatus(await ctx.call('GET','/api/auth/registration-destinations'),200);
  assert.ok(list.some(g=>g.id===A.generator.id));
  assert.ok(list.every(g=>!('email' in g)&&!('phone' in g)&&!('password_hash' in g)));
  const gen=h.expectStatus(await ctx.call('POST','/api/owner/generators',{token:A.token,body:{name:'Unavailable',location_name:'Beirut',total_kw:10,status:'inactive'}}),201);
  const next=h.expectStatus(await ctx.call('GET','/api/auth/registration-destinations'),200);
  assert.ok(!next.some(g=>g.id===gen.id));
});
test('QA-LIVE-REG-002 registration creates a login-ready pending account without a meter or profile',async()=>{
  const a=await apply();
  assert.equal(a.user.role,'subscriber');assert.equal(a.user.password_hash,undefined);assert.equal(a.user.application.status,'pending');
  const [u]=await h.db.query('SELECT is_active,password_hash FROM users WHERE id=?',[a.user.id]);
  assert.equal(u.is_active,1);assert.notEqual(u.password_hash,a.body.password);
  const [count]=await h.db.query('SELECT COUNT(*) n FROM subscriber_profiles WHERE user_id=?',[a.user.id]);assert.equal(h.num(count.n),0);
  const dashboard=h.expectStatus(await ctx.call('GET','/api/subscriber/dashboard',{token:a.token}),200);
  assert.equal(dashboard.subscription,null);assert.equal(dashboard.registration_application.status,'pending');assert.equal(dashboard.registration_application.generator_id,A.generator.id);
  assert.deepEqual(h.expectStatus(await ctx.call('GET','/api/subscriber/bills',{token:a.token}),200),[]);
  assert.equal(h.expectStatus(await ctx.call('GET','/api/auth/me',{token:a.token}),200).id,a.user.id);
});
test('QA-LIVE-REG-003 invalid applications and duplicate credentials create no orphan account',async()=>{
  for(const patch of [{generator_id:0},{generator_id:2147483647},{location_address:''},{password:'@bad'},{meter_number:'CLIENT-ASSIGNED'}]){
    const body=requestBody(patch);const r=await ctx.call('POST','/api/auth/register',{body});assert.ok([409,422].includes(r.status),JSON.stringify(r.data));
    const [n]=await h.db.query('SELECT COUNT(*) n FROM users WHERE username=?',[body.username]);assert.equal(h.num(n.n),0);
  }
  const a=await apply({email:'reg'+h.uid()+'@example.com'});
  assert.equal((await ctx.call('POST','/api/auth/register',{body:requestBody({username:a.body.username})})).status,409);
  assert.equal((await ctx.call('POST','/api/auth/register',{body:requestBody({email:a.body.email})})).status,409);
});
test('QA-LIVE-REG-004 admin assignment is role-protected and restricted to the requested generator',async()=>{
  const a=await apply();
  assert.equal((await assign(a,{},A.token)).status,403);
  assert.equal((await assign(a,{},a.token)).status,403);
  assert.equal((await assign(a,{},null)).status,401);
  const wrong=await assign(a,{plan_id:B.plan.id});assert.equal(wrong.status,422);assert.equal(wrong.data.code,'APPLICATION_PLAN_MISMATCH');
  const [pending]=await h.db.query('SELECT status,subscriber_id FROM registration_applications WHERE id=?',[a.id]);assert.equal(pending.status,'pending');assert.equal(pending.subscriber_id,null);
  const meter='OK'+h.uid();const result=h.expectStatus(await assign(a,{meter_number:meter,initial_kwh_consumed:120}),200);
  const dashboard=h.expectStatus(await ctx.call('GET','/api/subscriber/dashboard',{token:a.token}),200);
  assert.equal(dashboard.subscription.meter_number,meter);assert.equal(dashboard.subscription.plan_id,A.plan.id);assert.equal(dashboard.subscription.user_id,a.user.id);
  assert.equal(dashboard.subscription.initial_kwh_consumed,'120.00');
  const other=h.expectStatus(await ctx.call('GET','/api/owner/subscribers',{token:B.token}),200);assert.ok(!other.some(s=>s.subscriber_id===result.subscriber_id));
  const notices=h.expectStatus(await ctx.call('GET','/api/notifications',{token:a.token}),200);assert.ok(JSON.stringify(notices).includes(meter));
});
test('QA-LIVE-REG-005 normalized duplicate meters and repeat assignments are rejected without partial profiles',async()=>{
  const existing=await h.createSubscriber(ctx,A,{meter:'DUP-'+h.uid()});const a=await apply();
  const r=await assign(a,{meter_number:existing.meter_number.replace(/-/g,'')});assert.equal(r.status,409);assert.equal(r.data.code,'METER_NUMBER_IN_USE');
  const [n]=await h.db.query('SELECT COUNT(*) n FROM subscriber_profiles WHERE user_id=?',[a.user.id]);assert.equal(h.num(n.n),0);
  const responses=await Promise.all([assign(a),ctx.call('PUT',`/api/owner/registration-applications/${a.id}/assign-meter`,{token:A.token,body:{plan_id:A.plan.id,meter_number:'M'+h.uid()}})]);assert.deepEqual(responses.map(x=>x.status).sort(),[200,409]);
  const [counts]=await h.db.query('SELECT COUNT(*) n FROM subscriber_profiles WHERE user_id=?',[a.user.id]);assert.equal(h.num(counts.n),1);
});
test('QA-LIVE-REG-006 concurrent duplicate registration yields one complete account/application pair',async()=>{
  const body=requestBody();const results=await Promise.all([1,2].map(()=>ctx.call('POST','/api/auth/register',{body})));
  assert.deepEqual(results.map(x=>x.status).sort(),[201,409]);
  const [n]=await h.db.query('SELECT COUNT(*) n FROM users u JOIN registration_applications a ON a.user_id=u.id WHERE u.username=?',[body.username]);assert.equal(h.num(n.n),1);
});
test('QA-LIVE-REG-007 destination deactivation after registration leaves the application pending',async()=>{
  const gen=h.expectStatus(await ctx.call('POST','/api/owner/generators',{token:A.token,body:{name:'Closing area',location_name:'Beirut',total_kw:10}}),201);
  const a=await apply({generator_id:gen.id});
  h.expectStatus(await ctx.call('DELETE',`/api/owner/generators/${gen.id}`,{token:A.token}),200);
  const r=await assign(a);assert.equal(r.status,409);assert.equal(r.data.code,'DESTINATION_UNAVAILABLE');
  const [row]=await h.db.query('SELECT status,subscriber_id FROM registration_applications WHERE id=?',[a.id]);assert.equal(row.status,'pending');assert.equal(row.subscriber_id,null);
});

test('QA-LIVE-REG-008 responsible owner can review and assign; other owners and non-staff cannot',async()=>{
  const a=await apply();const b=await apply({generator_id:B.generator.id});
  const ownPath='/api/owner/registration-applications';
  const list=h.expectStatus(await ctx.call('GET',ownPath,{token:A.token}),200);
  assert.ok(list.some(x=>x.id===a.id));assert.ok(!list.some(x=>x.id===b.id));
  const ownedGenerators=await h.db.query('SELECT g.id FROM generators g JOIN generator_owners go ON go.id=g.owner_id WHERE go.user_id=?',[A.userId]);
  for(const status of ['assigned','all']){
    const filtered=h.expectStatus(await ctx.call('GET',ownPath+'?status='+status,{token:A.token}),200);
    assert.ok(filtered.every(x=>ownedGenerators.some(g=>g.id===x.generator_id)));
  }
  const detail=h.expectStatus(await ctx.call('GET',`${ownPath}/${a.id}`,{token:A.token}),200);
  assert.ok(detail.plans.some(p=>p.id===A.plan.id));assert.ok(!detail.plans.some(p=>p.id===B.plan.id));
  assert.equal((await ctx.call('GET',`${ownPath}/${b.id}`,{token:A.token})).status,404);
  assert.equal((await ctx.call('PUT',`${ownPath}/${b.id}/assign-meter`,{token:A.token,body:{meter_number:'OTHER'+h.uid(),plan_id:B.plan.id}})).status,404);
  assert.equal((await ctx.call('PUT',`${ownPath}/${a.id}/assign-meter`,{token:A.token,body:{meter_number:'WRONG'+h.uid(),plan_id:B.plan.id}})).status,422);
  const collector=await h.createCollector(ctx,A);
  for(const token of [a.token,collector.token]){
    assert.equal((await ctx.call('GET',ownPath,{token})).status,403);
    assert.equal((await ctx.call('PUT',`${ownPath}/${a.id}/assign-meter`,{token,body:{meter_number:'DENIED',plan_id:A.plan.id}})).status,403);
  }
  const notices=h.expectStatus(await ctx.call('GET','/api/notifications',{token:A.token}),200);
  assert.ok(JSON.stringify(notices).includes('/owner/applications'));
  const meter='OWNER'+h.uid();
  h.expectStatus(await ctx.call('PUT',`${ownPath}/${a.id}/assign-meter`,{token:A.token,body:{meter_number:meter,plan_id:A.plan.id}}),200);
  const [saved]=await h.db.query('SELECT assigned_by,status FROM registration_applications WHERE id=?',[a.id]);
  assert.equal(saved.assigned_by,A.userId);assert.equal(saved.status,'assigned');
  const dashboard=h.expectStatus(await ctx.call('GET','/api/subscriber/dashboard',{token:a.token}),200);
  assert.equal(dashboard.subscription.meter_number,meter);
});
