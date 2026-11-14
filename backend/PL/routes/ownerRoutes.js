'use strict';
const express=require('express');
const {body,param,query}=require('express-validator');
const c=require('../controllers/ownerController');
const h=require('../../utils/asyncHandler');
const {authenticate,requireOwner}=require('../../middleware/auth');
const {validate}=require('../../middleware/validate');
const {upload,discardUploadOnFailure}=require('../../middleware/upload');

const r=express.Router();
r.use(authenticate,requireOwner);
const id=(name='id')=>param(name).isInt({min:1});
const period=[query('month').optional().isInt({min:1,max:12}),query('year').optional().isInt({min:2020,max:2200})];
const optionalNotes=(field='notes',max=500)=>body(field).optional({checkFalsy:true}).trim().isLength({max});
const paymentValidation=[
  id(),
  body('amount_lbp').optional().isFloat({gt:0}),
  body('amount_usd').optional().isFloat({gt:0}),
  body('amount_received_lbp').optional().isFloat({gt:0}),
  body('amount_received_usd').optional().isFloat({gt:0}),
  body('payment_method').optional().isIn(['cash','bank','other']),
  body('transaction_reference').optional({checkFalsy:true}).trim().isLength({max:120}),
  optionalNotes('notes',500),
];
const meterReadingValidation=[
  body('subscription_id').isInt({min:1}),
  body('reading_value').isFloat({min:0}),
  body('reading_date').optional({checkFalsy:true}).isISO8601({strict:true}),
  body('ocr').optional().isObject(),
];

r.get('/registration-applications',[query('status').optional().isIn(['pending','assigned','all'])],validate,h(c.listRegistrationApplications));
r.get('/registration-applications/:id',[id()],validate,h(c.registrationApplication));
r.put('/registration-applications/:id/assign-meter',[
  id(),body('meter_number').trim().isLength({min:1,max:100}),
  body('plan_id').isInt({min:1,max:2147483647}),
  body('initial_kwh_consumed').optional().isFloat({min:0,max:9999999999.99}),
  body('start_date').optional().isISO8601({strict:true}),
],validate,h(c.assignSubscriberMeter));
r.get('/dashboard',h(c.dashboard));
r.get('/settings',h(c.settings));
r.put('/settings',[
  body('vat_rate').optional().isFloat({min:0,max:100}),
  body('usd_lbp_rate').optional().isFloat({gt:0}),
  body('capital_lbp').optional().isFloat({min:0}),
  body('invoice_prefix').optional().trim().isLength({min:1,max:20}).matches(/^[A-Za-z0-9_-]+$/),
],validate,h(c.updateSettings));

r.get('/generators',h(c.listGenerators));
r.post('/generators',[body('name').trim().isLength({min:1,max:200}),body('location_name').trim().isLength({min:1,max:300}),body('total_kw').optional().isFloat({min:0}),body('max_amperage').optional({nullable:true}).isFloat({min:0}),body('status').optional().isIn(['active','inactive','maintenance'])],validate,h(c.createGenerator));
r.put('/generators/:id',[id(),body('name').optional().trim().isLength({min:1,max:200}),body('location_name').optional().trim().isLength({min:1,max:300}),body('total_kw').optional().isFloat({min:0}),body('max_amperage').optional({nullable:true}).isFloat({min:0}),body('status').optional().isIn(['active','inactive','maintenance'])],validate,h(c.updateGenerator));
r.delete('/generators/:id',[id()],validate,h(c.deleteGenerator));

r.get('/main-meters',h(c.listMainMeters));
r.post('/main-meters',[body('meter_number').trim().isLength({min:1,max:120}),body('initial_kwh').optional().isFloat({min:0})],validate,h(c.createMainMeter));
r.put('/main-meters/:id',[id(),body('meter_number').optional().trim().isLength({min:1,max:120}),body('initial_kwh').optional().isFloat({min:0})],validate,h(c.updateMainMeter));
r.delete('/main-meters/:id',[id()],validate,h(c.deleteMainMeter));

r.get('/plans',h(c.listPlans));
r.post('/plans',[body('generator_id').isInt({min:1}),body('name').trim().isLength({min:1,max:150}),body('ampere').isFloat({gt:0}),body('monthly_cost_lbp').optional().isFloat({min:0}),body('maintenance_lbp').optional().isFloat({min:0})],validate,h(c.createPlan));
r.put('/plans/:id',[id(),body('generator_id').optional().isInt({min:1}),body('name').optional().trim().isLength({min:1,max:150}),body('ampere').optional().isFloat({gt:0}),body('monthly_cost_lbp').optional().isFloat({min:0}),body('maintenance_lbp').optional().isFloat({min:0})],validate,h(c.updatePlan));
r.delete('/plans/:id',[id()],validate,h(c.deletePlan));

r.get('/plan-pricing-rules',period,validate,h(c.pricing));
r.put('/plan-pricing-rules',[body('plan_id').isInt({min:1}),body('month').isInt({min:1,max:12}),body('year').isInt({min:2020,max:2200}),body('threshold_kwh').optional().isFloat({min:0}),body('base_cost_below_lbp').optional().isFloat({min:0}),body('base_cost_above_lbp').optional().isFloat({min:0}),body('maintenance_lbp').optional().isFloat({min:0}),body('usd_lbp_rate').optional().isFloat({gt:0})],validate,h(c.savePricing));
r.delete('/plan-pricing-rules/:plan_id',[id('plan_id'),query('month').isInt({min:1,max:12}),query('year').isInt({min:2020,max:2200})],validate,h(c.deletePricing));

r.get('/subscribers',h(c.subscribers));
r.post('/subscribers/create',[body('full_name').trim().isLength({min:2,max:150}),body('location_address').trim().isLength({min:1,max:400}),body('plan_id').isInt({min:1}),body('main_meter_id').optional({nullable:true}).isInt({min:1}),body('meter_number').optional({checkFalsy:true}).trim().isLength({max:100}),body('initial_kwh_consumed').optional().isFloat({min:0}),body('fixed_amount_enabled').optional().isBoolean().toBoolean(),body('fixed_amount_usd').optional().isFloat({min:0}),body('start_date').optional({checkFalsy:true}).isISO8601({strict:true}),body('phone').optional({checkFalsy:true}).trim().isLength({max:30})],validate,h(c.createSubscriber));
r.put('/subscribers/:id',[id(),body('full_name').optional().trim().isLength({min:2,max:150}),body('location_address').optional().trim().isLength({min:1,max:400}),body('plan_id').optional().isInt({min:1}),body('main_meter_id').optional({nullable:true}).isInt({min:1}),body('meter_number').optional({checkFalsy:true}).trim().isLength({max:100}),body('initial_kwh_consumed').optional().isFloat({min:0}),body('fixed_amount_enabled').optional().isBoolean().toBoolean(),body('fixed_amount_usd').optional().isFloat({min:0}),body('account_status').optional().isIn(['active','inactive']),body('phone').optional({checkFalsy:true}).trim().isLength({max:30})],validate,h(c.updateSubscriber));
r.post('/subscribers/:id/account',[id(),body('username').trim().isLength({min:3,max:80}).matches(/^[A-Za-z0-9_.-]+$/),body('password').isLength({min:4,max:128}).matches(/^[A-Za-z0-9]+$/),body('email').optional({checkFalsy:true}).isEmail().isLength({max:150}),body('phone').optional({checkFalsy:true}).trim().isLength({min:6,max:30})],validate,h(c.createSubscriberAccount));
r.delete('/subscriptions/:id',[id()],validate,h(c.endSubscription));
r.delete('/subscriptions/:id/permanent',[id()],validate,h(c.deleteSubscriber));
r.post('/subscriptions/:id/resubscribe',[id(),body('plan_id').optional({nullable:true}).isInt({min:1})],validate,h(c.resubscribe));

r.get('/subscriptions/:subscription_id/readings',[id('subscription_id')],validate,h(c.readings));
r.post('/meter-readings/scan',upload.single('photo'),discardUploadOnFailure,h(c.scan));
r.post('/meter-readings',upload.single('photo'),discardUploadOnFailure,meterReadingValidation,validate,h(c.addReading));

r.get('/bills',[query('month').optional().isInt({min:1,max:12}),query('year').optional().isInt({min:2020,max:2200}),query('status').optional().isIn(['unpaid','partially_paid','paid','waived','carried_forward']),query('search').optional().isLength({max:150})],validate,h(c.bills));
r.post('/bills/combine',[body('bill_ids').isArray({min:2,max:24}),body('bill_ids.*').isInt({min:1})],validate,h(c.combineBills));
r.get('/bills/:id',[id()],validate,h(c.getBill));
r.post('/bills',[body('subscription_id').isInt({min:1}),body('month').isInt({min:1,max:12}),body('year').isInt({min:2020,max:2200}),body('meter_reading_id').optional({nullable:true}).isInt({min:1}),body('current_reading').optional({nullable:true}).isFloat({min:0}),body('previous_reading').optional({nullable:true}).isFloat({min:0}),body('reading_date').optional({checkFalsy:true}).isISO8601({strict:true}),optionalNotes('notes',500)],validate,h(c.generateBill));
r.put('/bills/:id/pay',paymentValidation,validate,h(c.payBill));
r.post('/bills/:id/remind',[id()],validate,h(c.remindBalance));
r.delete('/bills/:id',[id()],validate,h(c.deleteBill));
r.get('/payments',h(c.payments));

r.get('/collector',h(c.collectors));
r.post('/collector/create',[body('full_name').trim().isLength({min:2,max:150}),body('username').trim().isLength({min:3,max:80}).matches(/^[A-Za-z0-9_.-]+$/),body('password').isLength({min:4,max:128}).matches(/^[A-Za-z0-9]+$/),body('email').optional({checkFalsy:true}).isEmail().isLength({max:150}),body('phone').optional({checkFalsy:true}).trim().isLength({min:6,max:30})],validate,h(c.createCollector));
r.put('/collector/:id',[id(),body('full_name').optional().trim().isLength({min:2,max:150}),body('username').optional().trim().isLength({min:3,max:80}).matches(/^[A-Za-z0-9_.-]+$/),body('password').optional({checkFalsy:true}).isLength({min:4,max:128}).matches(/^[A-Za-z0-9]+$/),body('email').optional({checkFalsy:true}).isEmail().isLength({max:150}),body('phone').optional({checkFalsy:true}).trim().isLength({min:6,max:30}),body('is_active').optional().isBoolean().toBoolean()],validate,h(c.updateCollector));
r.delete('/collector/:id',[id()],validate,h(c.deleteCollector));
r.put('/collector/:id/assignments',[id(),body('generator_ids').optional().isArray({max:500}),body('generator_ids.*').optional().isInt({min:1}),body('subscriber_ids').optional().isArray({max:5000}),body('subscriber_ids.*').optional().isInt({min:1})],validate,h(c.assignments));
r.get('/collector/settlements',h(c.settlements));
r.put('/collector/settlements/:id/confirm',[id(),optionalNotes('notes',500)],validate,h(c.confirmSettlement));
r.put('/collector/settlements/:id/reject',[id(),optionalNotes('notes',500)],validate,h(c.rejectSettlement));

r.get('/generators/:generator_id/outages',[id('generator_id')],validate,h(c.outages));
r.post('/outages',[body('generator_id').isInt({min:1}),body('schedule_type').isIn(['one_time','recurring']),body('outage_date').optional({checkFalsy:true}).isISO8601({strict:true}),body('day_of_week').optional({nullable:true}).isInt({min:0,max:6}),body('start_time').matches(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),body('end_time').matches(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),optionalNotes('notes',1000)],validate,h(c.createOutage));
r.put('/outages/:id',[id(),body('generator_id').isInt({min:1}),body('schedule_type').isIn(['one_time','recurring']),body('outage_date').optional({checkFalsy:true}).isISO8601({strict:true}),body('day_of_week').optional({nullable:true}).isInt({min:0,max:6}),body('start_time').matches(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),body('end_time').matches(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),optionalNotes('notes',1000)],validate,h(c.updateOutage));
r.delete('/outages/:id',[id()],validate,h(c.deleteOutage));

r.get('/reports/summary',[query('month').optional().isInt({min:1,max:12}),query('year').optional().isInt({min:2020,max:2200})],validate,h(c.report));
module.exports=r;
