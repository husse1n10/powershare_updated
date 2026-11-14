'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeError}=require('../../middleware/errorHandler');

test('QA-ERR-001 duplicate MySQL records become controlled 409 conflicts',()=>{
  const e=normalizeError(Object.assign(new Error('Duplicate entry'),{code:'ER_DUP_ENTRY'}));
  assert.equal(e.statusCode,409);assert.equal(e.code,'DUPLICATE_RESOURCE');
});
test('QA-ERR-002 oversized uploads become controlled 422 errors',()=>{
  const e=normalizeError(Object.assign(new Error('File too large'),{name:'MulterError',code:'LIMIT_FILE_SIZE'}));
  assert.equal(e.statusCode,422);assert.equal(e.code,'UPLOAD_VALIDATION_ERROR');
});
test('QA-ERR-003 invalid meter image type becomes controlled 422 error',()=>{
  const e=normalizeError(new Error('Only JPG, PNG or WEBP images are allowed'));
  assert.equal(e.statusCode,422);assert.equal(e.code,'INVALID_IMAGE_TYPE');
});
test('QA-ERR-004 foreign-key integrity errors become controlled conflicts',()=>{
  const e=normalizeError(Object.assign(new Error('FK'),{code:'ER_ROW_IS_REFERENCED_2'}));
  assert.equal(e.statusCode,409);assert.equal(e.code,'DATA_INTEGRITY_CONFLICT');
});
