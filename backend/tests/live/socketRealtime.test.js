'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const jwt=require('jsonwebtoken');
const {io:Client}=require('socket.io-client');
const h=require('./helpers');
let ctx,T,SA,SB,billA;const sockets=[];
before(async()=>{
  ctx=await h.startServer();T=await h.createTenant(ctx,'rt',{months:[[1,2026]]});
  const a=await h.createSubscriber(ctx,T),b=await h.createSubscriber(ctx,T);
  SA=await h.createSubscriberAccount(ctx,T,a);SB=await h.createSubscriberAccount(ctx,T,b);
  billA=await h.generateBill(ctx,T.token,{subscription_id:a.subscription_id,month:1,year:2026,current_reading:1100});
});
after(async()=>{sockets.forEach(s=>s.disconnect());await h.stopServer(ctx);});
function connect(token){
  return new Promise((resolve,reject)=>{
    const s=Client(ctx.base,{auth:token===undefined?{}:{token},transports:['websocket'],reconnection:false,forceNew:true});sockets.push(s);
    s.on('connect',()=>resolve(s));s.on('connect_error',err=>reject(err));
  });
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

test('QA-LIVE-RT-001 unauthenticated and forged socket connections are refused',async()=>{
  await assert.rejects(connect(undefined),/unauthorized/);
  await assert.rejects(connect(jwt.sign({sub:SA.userId,role:'subscriber',type:'access',ver:1},'attacker-secret')),/unauthorized/);
  await assert.rejects(connect(jwt.sign({sub:SA.userId,role:'subscriber',type:'refresh',ver:1},process.env.JWT_SECRET)),/unauthorized/);
});

test('QA-LIVE-RT-002 a notification reaches only the authenticated owner of the room, even if another client asks to join it',async()=>{
  const a=await connect(SA.token),b=await connect(SB.token);
  const gotA=[],gotB=[];a.on('notification:new',n=>gotA.push(n));b.on('notification:new',n=>gotB.push(n));
  b.emit('join-user',SA.userId);b.emit('join',`user:${SA.userId}`);b.emit('subscribe',{userId:SA.userId});
  await sleep(200);
  h.expectStatus(await ctx.call('POST',`/api/owner/bills/${billA.id}/remind`,{token:T.token}),200);
  for(let i=0;i<30&&!gotA.length;i++)await sleep(100);
  await sleep(300);
  assert.equal(gotA.length,1);assert.equal(gotA[0].type,'balance');assert.equal(gotA[0].user_id,SA.userId);
  assert.deepEqual(gotB,[],'another subscriber must not receive the notification');
});

test('QA-LIVE-RT-003 a token invalidated by password change cannot open a socket',async()=>{
  h.expectStatus(await ctx.call('PUT','/api/auth/change-password',{token:SB.token,body:{current_password:h.PASSWORD,new_password:'Changed1234'}}),200);
  await assert.rejects(connect(SB.token),/unauthorized/);
});
