'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('QA-VALID-013 owner mutation routes validate positive integer resource IDs',()=>{
  const src=read('PL/routes/ownerRoutes.js');
  assert.match(src,/const id=\(name='id'\)=>param\(name\)\.isInt\(\{min:1\}\)/);
  for(const route of ["/generators/:id","/main-meters/:id","/plans/:id","/subscribers/:id","/bills/:id","/collector/:id","/outages/:id"]){
    assert.ok(src.includes(route),`missing route ${route}`);
  }
  assert.match(src,/r\.delete\('\/bills\/:id',\[id\(\)\],validate/);
  assert.match(src,/r\.get\('\/subscriptions\/:subscription_id\/readings',\[id\('subscription_id'\)\],validate/);
});

test('QA-VALID-014 collector and subscriber financial routes validate IDs and bounded payment amounts',()=>{
  const collector=read('PL/routes/collectorRoutes.js');
  const subscriber=read('PL/routes/subscriberRoutes.js');
  assert.match(collector,/r\.put\('\/bills\/:id\/pay',\[id\(\),body\('amount_lbp'\)\.optional\(\)\.isFloat\(\{gt:0\}\)/);
  assert.match(collector,/body\('notes'\)\.optional\(\{checkFalsy:true\}\)\.trim\(\)\.isLength\(\{max:500\}\)/);
  assert.match(subscriber,/r\.post\('\/bills\/:id\/simulated-payment',\[id\(\),body\('amount_lbp'\)\.optional\(\)\.isFloat\(\{gt:0\}\)/);
});

test('QA-VALID-015 bulk bill/assignment inputs have explicit size bounds',()=>{
  const owner=read('PL/routes/ownerRoutes.js');
  const collector=read('PL/routes/collectorRoutes.js');
  assert.match(owner,/body\('bill_ids'\)\.isArray\(\{min:2,max:24\}\)/);
  assert.match(collector,/body\('bill_ids'\)\.isArray\(\{min:2,max:24\}\)/);
  assert.match(owner,/body\('generator_ids'\)\.optional\(\)\.isArray\(\{max:500\}\)/);
  assert.match(owner,/body\('subscriber_ids'\)\.optional\(\)\.isArray\(\{max:5000\}\)/);
});

test('QA-ADMIN-002 admin dashboard uses current-period charges and payment-date collections',()=>{
  const src=read('DAL/repositories/adminRepository.js');
  assert.match(src,/SUM\(CASE WHEN combined_parent_bill_id IS NULL THEN total_ttc_lbp ELSE 0 END\).*total_billed_lbp/);
  assert.match(src,/FROM payments p WHERE p\.status='completed' AND MONTH\(p\.paid_at\)=\? AND YEAR\(p\.paid_at\)=\?/);
  assert.match(src,/SUM\(CASE WHEN status IN \('unpaid','partially_paid'\) THEN remaining_balance_lbp ELSE 0 END\).*outstanding_lbp/);
});

test('QA-SETTINGS-004 platform setting updates are validated and audit logged',()=>{
  const service=read('BLL/services/adminService.js');
  const controller=read('PL/controllers/adminController.js');
  assert.match(service,/normalizePlatformSetting\(key,value\)/);
  assert.match(service,/PLATFORM_SETTING_UPDATED/);
  assert.match(controller,/service\.updateSetting\(req\.params\.key,req\.body\.value,req\)/);
});

test('QA-SESSION-002 refresh scheduler decodes JWT Base64URL safely',()=>{
  const src=fs.readFileSync(path.resolve(root,'../frontend/src/contexts/AuthContext.js'),'utf8');
  assert.match(src,/replace\(\/-\/g, '\+'\)\.replace\(\/_\/g, '\/'\)/);
  assert.match(src,/padEnd\(Math\.ceil\(encoded\.length \/ 4\) \* 4, '='\)/);
  assert.match(src,/JSON\.parse\(atob\(base64\)\)/);
});

test('QA-OPS-001 readiness endpoint checks database connectivity and returns 503 when unavailable',()=>{
  const src=read('app.js');
  assert.match(src,/app\.get\('\/api\/ready'/);
  assert.match(src,/health\.isDatabaseReady\(\)/);
  assert.doesNotMatch(src,/require\(['"][^'"]*DAL\//,'app.js (PL) must not import the DAL');
  const service=read('BLL/services/healthService.js');
  assert.match(service,/healthRepo\.ping\(\)/);
  assert.match(src,/res\.status\(503\)\.json\(\{status:'not_ready',database:'unavailable'/);
});

test('QA-SEC-015 meter uploads are not exposed through an anonymous static route',()=>{
  const src=read('app.js');
  assert.doesNotMatch(src,/app\.use\(['"]\/uploads['"],\s*express\.static/);
});

test('QA-UPLOAD-003 temporary OCR scan photos are deleted after owner and collector scans',()=>{
  const src=read('BLL/services/meterService.js');
  const ownerBlock=src.match(/async function scanForOwner[\s\S]*?async function scanForCollector/)?.[0] || '';
  const collectorBlock=src.match(/async function scanForCollector[\s\S]*?async function addReading/)?.[0] || '';
  assert.match(ownerBlock,/finally\{[\s\S]*fs\.unlink\(imagePath\)\.catch/);
  assert.match(collectorBlock,/finally\{[\s\S]*fs\.unlink\(imagePath\)\.catch/);
  assert.match(src,/photo_path:photoPath\?path\.relative\(process\.cwd\(\),photoPath\):null/);
});

test('QA-UPLOAD-004 frontend meter scanner only offers backend-supported JPG PNG and WEBP formats',()=>{
  const src=fs.readFileSync(path.resolve(root,'../frontend/src/components/Shared/MeterScanPage.js'),'utf8');
  assert.match(src,/supportedMime = \/\^\(image\\\/\(jpeg\|png\|webp\)\)\$\/i/);
  assert.match(src,/accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(src,/accept="image\/png,image\/jpeg,image\/webp"/);
  assert.doesNotMatch(src,/gif\|bmp\|heic\|heif/);
});
