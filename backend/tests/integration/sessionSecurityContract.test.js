'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,p),'utf8');
const schema=read('../../database/schema.sql');
const authController=read('../../PL/controllers/authController.js');
const authMiddleware=read('../../middleware/auth.js');
const authService=read('../../BLL/services/authService.js');
const tokenService=read('../../BLL/services/accessTokenService.js');
const authContext=read('../../../frontend/src/contexts/AuthContext.js');
const api=read('../../../frontend/src/services/api.js');

test('QA-SEC-008 refresh token is stored in an HttpOnly cookie',()=>{
  assert.match(authController,/httpOnly:true/);
  assert.match(authController,/powershare_refresh/);
  assert.match(api,/withCredentials:\s*true/);
});

test('QA-SEC-009 frontend does not persist authentication tokens in localStorage',()=>{
  assert.doesNotMatch(authContext,/localStorage\.(setItem|getItem).*Token/i);
  assert.doesNotMatch(api,/localStorage\.(setItem|getItem).*Token/i);
});

test('QA-SEC-010 password/session invalidation uses auth_version in token validation',()=>{
  assert.match(schema,/auth_version INT NOT NULL DEFAULT 1/);
  assert.match(authService,/ver:Number\(user\.auth_version\|\|1\)/);
  assert.match(authService,/bumpAuthVersion/);
  assert.match(tokenService,/payload\.ver/);
  assert.match(tokenService,/SESSION_INVALIDATED/);
  assert.match(authMiddleware,/authenticateAccessToken\(token\)/);
});

test('QA-SEC-011 expired access tokens return TOKEN_EXPIRED for controlled refresh',()=>{
  assert.match(tokenService,/TokenExpiredError/);
  assert.match(tokenService,/TOKEN_EXPIRED/);
  assert.match(api,/TOKEN_EXPIRED/);
});
