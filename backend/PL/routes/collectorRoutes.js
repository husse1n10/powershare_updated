'use strict';
const express=require('express');
const {body,param,query}=require('express-validator');
const c=require('../controllers/collectorController');
const h=require('../../utils/asyncHandler');
const {authenticate,requireCollector}=require('../../middleware/auth');
const {validate}=require('../../middleware/validate');
const {upload,discardUploadOnFailure}=require('../../middleware/upload');

const r=express.Router();
r.use(authenticate,requireCollector);
const id=(name='id')=>param(name).isInt({min:1});

r.get('/dashboard',h(c.dashboard));
r.get('/subscribers',h(c.subscribers));
r.get('/bills',[query('month').optional().isInt({min:1,max:12}),query('year').optional().isInt({min:2020,max:2200}),query('status').optional().isIn(['unpaid','partially_paid','paid','waived','carried_forward']),query('search').optional().isLength({max:150})],validate,h(c.bills));
r.post('/bills/combine',[body('bill_ids').isArray({min:2,max:24}),body('bill_ids.*').isInt({min:1})],validate,h(c.combineBills));
r.post('/bills',[body('subscription_id').isInt({min:1}),body('month').isInt({min:1,max:12}),body('year').isInt({min:2020,max:2200}),body('meter_reading_id').optional({nullable:true}).isInt({min:1}),body('current_reading').optional({nullable:true}).isFloat({min:0}),body('ocr_confirmed').optional().isBoolean().toBoolean(),body('ocr').optional().isObject(),body('ocr.meterNumber').optional().isString().isLength({max:100}),body('ocr.readingValue').optional({nullable:true}).isFloat({min:0}),body('ocr.confidence').optional({nullable:true}).isFloat({min:0,max:100}),body('previous_reading').optional({nullable:true}).isFloat({min:0}),body('reading_date').optional({checkFalsy:true}).isISO8601({strict:true}),body('notes').optional({checkFalsy:true}).trim().isLength({max:500})],validate,h(c.generateBill));
r.get('/bills/:id',[id()],validate,h(c.bill));
r.put('/bills/:id/pay',[id(),body('amount_lbp').optional().isFloat({gt:0}),body('amount_usd').optional().isFloat({gt:0}),body('amount_received_lbp').optional().isFloat({gt:0}),body('amount_received_usd').optional().isFloat({gt:0}),body('notes').optional({checkFalsy:true}).trim().isLength({max:500})],validate,h(c.pay));
r.get('/subscriptions/:subscription_id/readings',[id('subscription_id')],validate,h(c.readings));
r.post('/meter-readings/scan',upload.single('photo'),discardUploadOnFailure,h(c.scan));
r.post('/meter-readings',upload.single('photo'),discardUploadOnFailure,[body('subscription_id').isInt({min:1}),body('reading_value').isFloat({min:0}),body('reading_date').optional({checkFalsy:true}).isISO8601({strict:true}),body('ocr').optional().isObject()],validate,h(c.addReading));
r.get('/wallet',h(c.wallet));
r.get('/settlements',h(c.settlements));
r.post('/settlements/request',[body('amount_lbp').isFloat({gt:0}),body('notes').optional({checkFalsy:true}).trim().isLength({max:500})],validate,h(c.requestSettlement));
module.exports=r;
