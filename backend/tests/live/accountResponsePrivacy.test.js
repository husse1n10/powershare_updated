'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const h=require('./helpers');
let ctx,T;
before(async()=>{ctx=await h.startServer();T=await h.createTenant(ctx,'privacy');});
after(()=>h.stopServer(ctx));
function publicResponse(r,status){h.expectStatus(r,status);assert.ok(!JSON.stringify(r.data).includes('password_hash'),'Password hashes must not cross the HTTP boundary');return r.data;}
test('account mutations do not disclose stored password hashes',async()=>{
  const username='privacy'+h.uid();
  const owner=publicResponse(await ctx.call('POST','/api/admin/users',{token:ctx.adminToken,body:{full_name:'QA Privacy Owner',username,password:h.PASSWORD,role:'owner'}}),201);
  publicResponse(await ctx.call('PUT',`/api/admin/users/${owner.id}`,{token:ctx.adminToken,body:{full_name:'QA Updated Privacy Owner'}}),200);
  publicResponse(await ctx.call('PUT',`/api/admin/users/${owner.id}`,{token:ctx.adminToken,body:{password:'NewPrivacy1!'}}),200);
  assert.equal((await ctx.call('POST','/api/auth/login',{body:{username,password:'NewPrivacy1!'}})).status,200);
  publicResponse(await ctx.call('DELETE',`/api/admin/users/${owner.id}`,{token:ctx.adminToken}),200);
  const sub=await h.createSubscriber(ctx,T);
  const portal=publicResponse(await ctx.call('POST',`/api/owner/subscribers/${sub.subscriber_id}/account`,{token:T.token,body:{username:'subprivacy'+h.uid(),password:h.PASSWORD}}),201);
  assert.equal(portal.role,'subscriber');
  assert.equal((await ctx.call('POST','/api/auth/login',{body:{username:portal.username,password:h.PASSWORD}})).status,200);
});

test('saved platform name is returned with login and reloaded profiles',async()=>{
  const settings=h.expectStatus(await ctx.call('GET','/api/admin/settings',{token:ctx.adminToken}),200);
  const previous=settings.find(x=>x.setting_key==='platform_name').setting_value;
  try{
    h.expectStatus(await ctx.call('PUT','/api/admin/settings/platform_name',{token:ctx.adminToken,body:{value:'QA Branded Power'}}),200);
    const login=h.expectStatus(await ctx.call('POST','/api/auth/login',{body:{username:T.username,password:h.PASSWORD}}),200);
    assert.equal(login.user.platform_name,'QA Branded Power');
    const me=h.expectStatus(await ctx.call('GET','/api/auth/me',{token:login.accessToken}),200);
    assert.equal(me.platform_name,'QA Branded Power');
  }finally{h.expectStatus(await ctx.call('PUT','/api/admin/settings/platform_name',{token:ctx.adminToken,body:{value:previous}}),200);}
});
