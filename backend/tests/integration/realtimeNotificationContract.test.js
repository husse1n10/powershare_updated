'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,p),'utf8');

const server=read('../../PL/realtime/socketServer.js');
const serverEntry=read('../../server.js');
const socketAuth=read('../../BLL/services/accessTokenService.js');
const notificationService=read('../../BLL/services/notificationService.js');
const authContext=read('../../../frontend/src/contexts/AuthContext.js');
const layout=read('../../../frontend/src/components/Layout/Layout.js');
const notificationsPage=read('../../../frontend/src/components/Shared/NotificationsPage.js');
const publicIndex=read('../../../frontend/public/index.html');

test('QA-SEC-013 socket rooms are derived from authenticated access token rather than client supplied user id',()=>{
  assert.match(server,/io\.use\(async\(socket,next\)=>/);
  assert.match(server,/tokenAuth\.authenticateAccessToken\(socket\.handshake\.auth\?\.token\)/);
  assert.match(serverEntry,/attachSocketServer\(server/);
  assert.match(server,/socket\.join\(`user:\$\{socket\.user\.id\}`\)/);
  assert.doesNotMatch(server,/join-user/);
  assert.match(socketAuth,/payload\.type!=='access'/);
  assert.match(socketAuth,/user\.auth_version/);
});

test('QA-NOTIFY-009 persisted notifications are emitted to the authenticated user room',()=>{
  assert.match(notificationService,/const row=await repo\.create/);
  assert.match(notificationService,/realtimeEmitter\(Number\(userId\),row\)/);
  assert.match(server,/io\.to\(`user:\$\{userId\}`\)\.emit\('notification:new',notification\)/);
});

test('QA-NOTIFY-010 frontend uses in-memory access token for realtime notifications and unread badge',()=>{
  assert.match(authContext,/accessToken, setAccessToken/);
  assert.match(authContext,/value=\{\{ user, accessToken,/);
  assert.match(publicIndex,/\/socket\.io\/socket\.io\.js/);
  assert.match(layout,/window\.io\(\{ auth: \{ token: accessToken \}/);
  assert.match(layout,/notification:new/);
  assert.match(layout,/unreadNotifications > 0/);
  assert.match(notificationsPage,/powershare:notification-new/);
  assert.match(notificationsPage,/powershare:notifications-changed/);
});
