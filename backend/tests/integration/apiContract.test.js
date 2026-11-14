'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

test('QA-API-001 every concrete frontend API call has a backend route',()=>{
  const script=path.resolve(__dirname,'../../scripts/check-api-contract.js');
  const result=spawnSync(process.execPath,[script],{encoding:'utf8'});
  assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`);
});
