'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {poolConfig}=require('../../DAL/database/config');
test('QA-POOL-001 pool respects a bounded per-process connection budget',()=>{
  const previous={JAWSDB_URL:process.env.JAWSDB_URL,DB_POOL_SIZE:process.env.DB_POOL_SIZE};
  try{
    delete process.env.DB_POOL_SIZE;process.env.JAWSDB_URL='mysql://qa:qa@localhost/qa';assert.equal(poolConfig().connectionLimit,2);
    delete process.env.JAWSDB_URL;assert.equal(poolConfig().connectionLimit,10);
    process.env.DB_POOL_SIZE='3';assert.equal(poolConfig().connectionLimit,3);
    for(const invalid of ['0','-1','1.5','abc','101']){process.env.DB_POOL_SIZE=invalid;assert.throws(()=>poolConfig(),/DB_POOL_SIZE/);}
  }finally{for(const[key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
