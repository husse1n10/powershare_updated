'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {errorHandler}=require('../../middleware/errorHandler');
test('QA-POOL-002 provider resource exhaustion is controlled and does not leak database details',()=>{
  const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';
  try{
    for(const code of ['ER_USER_LIMIT_REACHED','ER_TOO_MANY_USER_CONNECTIONS','ER_CON_COUNT_ERROR']){
      const result={};const response={set:(key,value)=>{result[key]=value;return response;},status:value=>{result.status=value;return response;},json:value=>{result.body=value;return response;}};
      errorHandler(Object.assign(new Error('private database account detail'),{code}),{},response,()=>{});
      assert.equal(result.status,503);assert.equal(result['Retry-After'],'5');assert.equal(result.body.code,'DATABASE_BUSY');assert.ok(!JSON.stringify(result.body).includes('private database account'));
    }
  }finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
});
