'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const jwt=require('jsonwebtoken');
const h=require('./helpers');
let ctx,T;
before(async()=>{ctx=await h.startServer();T=await h.createTenant(ctx,'aut');});
after(()=>h.stopServer(ctx));
async function loginRaw(username,password=h.PASSWORD){
  const r=await ctx.call('POST','/api/auth/login',{body:{username,password}});
  const raw=r.headers.getSetCookie().find(c=>c.startsWith('powershare_refresh='));
  return {...r,rawCookie:raw,cookie:raw?raw.split(';')[0]:null};
}
const refresh=cookie=>ctx.call('POST','/api/auth/refresh',{cookie,body:{}});
const newUser=async()=>{const c=await h.createCollector(ctx,T);return c.username;};

test('QA-LIVE-AUTH-001 login returns an in-memory access token and an HttpOnly refresh cookie; no secrets in the body',async()=>{
  const r=await loginRaw(T.username);
  assert.equal(r.status,200);assert.ok(r.data.accessToken);assert.equal(r.data.refreshToken,undefined);assert.equal(r.data.user.password_hash,undefined);
  assert.match(r.rawCookie,/HttpOnly/i);assert.match(r.rawCookie,/Path=\/api\/auth/);assert.match(r.rawCookie,/SameSite=Lax/i);
});

test('QA-LIVE-AUTH-002 refresh rotates the token; a used refresh token is rejected',async()=>{
  const first=await loginRaw(T.username);
  const r1=await refresh(first.cookie);assert.equal(r1.status,200);assert.ok(r1.data.accessToken);
  const next=r1.headers.getSetCookie().find(c=>c.startsWith('powershare_refresh=')).split(';')[0];
  assert.notEqual(next,first.cookie);
  const reuse=await refresh(first.cookie);assert.equal(reuse.status,401);assert.equal(reuse.data.code,'REFRESH_REVOKED');
  assert.equal((await refresh(next)).status,200);
});

test('QA-LIVE-AUTH-003 (DEF-064) concurrent refreshes with one token mint exactly one new session',async()=>{
  const {cookie}=await loginRaw(T.username);
  const results=await Promise.all([1,2,3,4].map(()=>refresh(cookie)));
  assert.equal(results.filter(r=>r.status===200).length,1,JSON.stringify(results.map(r=>r.status)));
});

test('QA-LIVE-AUTH-004 logout revokes the refresh token',async()=>{
  const {cookie}=await loginRaw(T.username);
  assert.equal((await ctx.call('POST','/api/auth/logout',{cookie,body:{}})).status,200);
  assert.equal((await refresh(cookie)).status,401);
});

test('QA-LIVE-AUTH-005 password change invalidates existing access and refresh tokens',async()=>{
  const username=await newUser();const s=await loginRaw(username);
  h.expectStatus(await ctx.call('PUT','/api/auth/change-password',{token:s.data.accessToken,body:{current_password:h.PASSWORD,new_password:'NewPass9876!'}}),200);
  const me=await ctx.call('GET','/api/auth/me',{token:s.data.accessToken});assert.equal(me.status,401);assert.equal(me.data.code,'SESSION_INVALIDATED');
  assert.equal((await refresh(s.cookie)).status,401);
  assert.equal((await loginRaw(username)).status,401,'old password no longer works');
  assert.equal((await loginRaw(username,'NewPass9876!')).status,200);
});

test('QA-LIVE-AUTH-006 a deactivated account loses access immediately and cannot log in',async()=>{
  const c=await h.createCollector(ctx,T);
  h.expectStatus(await ctx.call('DELETE',`/api/owner/collector/${c.id}`,{token:T.token}),200);
  const r=await ctx.call('GET','/api/collector/dashboard',{token:c.token});assert.equal(r.status,403);assert.equal(r.data.code,'ACCOUNT_INACTIVE');
  assert.equal((await loginRaw(c.username)).status,401);
});

test('QA-LIVE-AUTH-007 forged, expired, wrong-type and alg:none tokens are rejected',async()=>{
  const [admin]=await h.db.query("SELECT id FROM users WHERE username='admin'");
  const claims={sub:admin.id,role:'admin',type:'access',ver:1};
  const cases={
    wrongSecret:jwt.sign(claims,'attacker-secret'),
    algNone:jwt.sign(claims,null,{algorithm:'none'}),
    expired:jwt.sign({...claims,exp:Math.floor(Date.now()/1000)-60},process.env.JWT_SECRET),
    refreshType:jwt.sign({...claims,type:'refresh'},process.env.JWT_SECRET),
    malformed:'not.a.jwt',
  };
  for(const [name,token] of Object.entries(cases)){const r=await ctx.call('GET','/api/admin/users',{token});assert.equal(r.status,401,name);}
  assert.equal((await ctx.call('GET','/api/admin/users',{token:cases.expired})).data.code,'TOKEN_EXPIRED');
});

test('QA-LIVE-AUTH-008 failed login is audited without storing the attempted password',async()=>{
  const secret=`Wrong${h.uid()}`;
  const r=await loginRaw(T.username,secret);assert.equal(r.status,401);assert.equal(r.data.code,'INVALID_CREDENTIALS');
  const rows=await h.db.query("SELECT CAST(details_json AS CHAR) d FROM audit_logs WHERE action='LOGIN_FAILED' ORDER BY id DESC LIMIT 5");
  assert.ok(rows.length>0);assert.ok(rows.every(x=>!String(x.d).includes(secret)));
});
