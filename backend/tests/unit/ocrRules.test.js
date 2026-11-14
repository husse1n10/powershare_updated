'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {normalizeMeterNumber,parseOcrText}=require('../../BLL/domain/ocrRules');
test('QA-OCR-001 normalizes meter number safely',()=>{assert.equal(normalizeMeterNumber('mtr- 10.01'),'MTR1001');});
test('QA-OCR-002 extracts labeled meter number and reading',()=>{const r=parseOcrText('METER: MTR-1001\nREADING: 18487.5 kWh');assert.equal(r.meterNumber,'MTR1001');assert.equal(r.readingValue,18487.5);});
test('QA-OCR-003 accepts comma decimal reading',()=>{const r=parseOcrText('NO: 998877\nINDEX 1250,25');assert.equal(r.meterNumber,'998877');assert.equal(r.readingValue,1250.25);});
test('QA-OCR-004 returns null reading when OCR text contains no usable number',()=>{const r=parseOcrText('unreadable image');assert.equal(r.readingValue,null);assert.equal(r.meterNumber,'');});

// Upload-presence behavior is enforced by meterService before OCR starts; the
// API route uses optional req.file access so a missing upload returns a controlled error.
