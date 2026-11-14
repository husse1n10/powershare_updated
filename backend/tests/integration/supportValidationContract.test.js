'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const routes=fs.readFileSync(path.join(__dirname,'..','..','PL','routes','commonRoutes.js'),'utf8');

test('QA-SUPPORT-004 support inputs have bounded category priority subject and message validation',()=>{
  assert.match(routes,/subject.*isLength\(\{min:3,max:200\}\)/);
  assert.match(routes,/category.*isIn\(\['billing','meter','payment','outage','account','technical','other'\]\)/);
  assert.match(routes,/priority.*isIn\(\['low','medium','high'\]\)/);
  assert.match(routes,/message.*isLength\(\{min:1,max:5000\}\)/);
});

test('QA-NOTIFY-008 notification endpoint validates a bounded limit and notification id',()=>{
  assert.match(routes,/limit.*isInt\(\{min:1,max:100\}\)/);
  assert.match(routes,/notifications\/:id\/read.*param\('id'\)\.isInt\(\{min:1\}\)/s);
});
