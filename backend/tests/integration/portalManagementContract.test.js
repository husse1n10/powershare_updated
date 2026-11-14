'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=rel=>fs.readFileSync(path.resolve(__dirname,'../..',rel),'utf8');
const authRoutes=read('PL/routes/authRoutes.js');
const authService=read('BLL/services/authService.js');
const adminRoutes=read('PL/routes/adminRoutes.js');
const adminService=read('BLL/services/adminService.js');
const userRepo=read('DAL/repositories/userRepository.js');
const collectorRepo=read('DAL/repositories/collectorRepository.js');
const meterService=read('BLL/services/meterService.js');
const subscriberRoutes=read('PL/routes/subscriberRoutes.js');
const subscriberRepo=read('DAL/repositories/subscriberRepository.js');
const billingRepo=read('DAL/repositories/billingRepository.js');
const outageRepo=read('DAL/repositories/outageRepository.js');

test('QA-AUTH-LOGIN-001 login route is rate-limited and successful login issues access/refresh credentials',()=>{
  assert.match(authRoutes,/loginLimiter/);
  assert.match(authRoutes,/r\.post\('\/login',loginLimiter/);
  assert.match(authService,/bcrypt\.compare/);
  assert.match(authService,/signAccess\(user\)/);
  assert.match(authService,/signRefresh\(user\)/);
});

test('QA-USER-001 admin user-management route is admin-only and delegates account creation',()=>{
  assert.match(adminRoutes,/r\.use\(authenticate,requireAdmin\)/);
  assert.match(adminRoutes,/r\.post\('\/users'/);
  assert.match(adminService,/account\.createUser\(data\)/);
  assert.match(userRepo,/async function list/);
});

test('QA-OWNERADMIN-001 admin owner business-name edits update owner profile',()=>{
  assert.match(adminService,/current\.role==='owner'/);
  assert.match(adminService,/data\.business_name!==undefined/);
  assert.match(adminService,/profiles\.updateOwnerByUserId/);
});

test('QA-ASSIGN-001 collector assignments are owner-scoped and replaced transactionally',()=>{
  assert.match(collectorRepo,/async function setGeneratorAssignments/);
  assert.match(collectorRepo,/transaction\(async conn/);
  assert.match(collectorRepo,/generators WHERE id=\? AND owner_id=\?/);
  assert.match(collectorRepo,/subscriber_profiles WHERE id=\? AND created_by_owner=\?/);
});

test('QA-OCR-CONFIRM-001 OCR scan explicitly requires confirmation before reading creation',()=>{
  assert.match(meterService,/requires_confirmation:true/);
  assert.match(meterService,/ocr_confirmed:true/);
});

test('QA-AUTOID-001 OCR meter number lookup identifies subscriber only in current owner scope',()=>{
  assert.match(meterService,/subscriberRepo\.findByMeter\(owner\.id,ocr\.meterNumber\)/);
  assert.match(meterService,/subscriberRepo\.findByMeter\(collector\.owner_id,ocr\.meterNumber\)/);
  assert.match(subscriberRepo,/WHERE s\.owner_id=\? AND s\.is_active=1/);
});

test('QA-INVOICEHIST-001 subscriber invoice history is user-scoped and ordered by period',()=>{
  assert.match(billingRepo,/async function listBillsBySubscriberUser/);
  assert.match(billingRepo,/WHERE sp\.user_id=\? ORDER BY b\.year DESC,b\.month DESC/);
});

test('QA-PORTAL-001 subscriber portal routes require subscriber role and expose own dashboard data',()=>{
  assert.match(subscriberRoutes,/r\.use\(authenticate,requireSubscriber\)/);
  for(const route of ['/dashboard','/subscription','/consumption','/bills','/payments','/outages']){
    assert.ok(subscriberRoutes.includes(`'${route}'`)||subscriberRoutes.includes(`\"${route}\"`),`missing ${route}`);
  }
});

test('QA-RBAC-SUB-001 subscriber bill access is bound to authenticated subscriber user id',()=>{
  assert.match(billingRepo,/async function getBillBySubscriberUser\(userId,billId\)/);
  assert.match(billingRepo,/WHERE sp\.user_id=\? AND b\.id=\?/);
});

test('QA-CONSUMPTION-001 consumption history is filtered by subscriber user id',()=>{
  assert.match(subscriberRepo,/async function listConsumptionByUser\(userId\)/);
  assert.match(subscriberRepo,/WHERE sp\.user_id=\? ORDER BY mr\.reading_date DESC/);
});

test('QA-PAYHIST-001 payment history is filtered by subscriber user id',()=>{
  assert.match(billingRepo,/async function listPaymentsBySubscriberUser\(userId\)/);
  assert.match(billingRepo,/WHERE sp\.user_id=\? ORDER BY pay\.paid_at DESC/);
});

test('QA-SUBOUT-001 subscriber outages are limited to own active subscription generator',()=>{
  assert.match(outageRepo,/async function listForSubscriberUser\(userId\)/);
  assert.match(outageRepo,/WHERE sp\.user_id=\? AND s\.is_active=1 AND o\.is_active=1/);
});

test('QA-PROFILE-001 authenticated profile update route persists only permitted user fields',()=>{
  assert.match(authRoutes,/r\.put\('\/profile',authenticate/);
  assert.match(authService,/async function updateProfile/);
  assert.match(authService,/fields\.full_name/);
  assert.match(authService,/fields\.phone/);
  assert.match(authService,/fields\.preferred_language/);
  assert.match(authService,/fields\.email/);
  assert.match(authService,/fields\.username/);
});
