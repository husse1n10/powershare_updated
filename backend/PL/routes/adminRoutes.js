'use strict';
const express=require('express');
const {body,param,query}=require('express-validator');
const c=require('../controllers/adminController');
const h=require('../../utils/asyncHandler');
const {authenticate,requireAdmin}=require('../../middleware/auth');
const {validate}=require('../../middleware/validate');

const r=express.Router();
r.use(authenticate,requireAdmin);
const id=(name='id')=>param(name).isInt({min:1});
const period=[query('month').optional().isInt({min:1,max:12}),query('year').optional().isInt({min:2020,max:2200})];

r.get('/registration-applications',[query('status').optional().isIn(['pending','assigned','all'])],validate,h(c.listRegistrationApplications));
r.get('/registration-applications/:id',[id()],validate,h(c.registrationApplication));
r.put('/registration-applications/:id/assign-meter',[
  id(),body('meter_number').trim().isLength({min:1,max:100}),
  body('plan_id').isInt({min:1,max:2147483647}),
  body('initial_kwh_consumed').optional().isFloat({min:0,max:9999999999.99}),
  body('start_date').optional().isISO8601({strict:true}),
],validate,h(c.assignSubscriberMeter));
r.get('/dashboard',period,validate,h(c.dashboard));
r.get('/users',[
  query('role').optional().isIn(['admin','owner','collector','subscriber']),
  query('search').optional().trim().isLength({max:150}),
],validate,h(c.listUsers));
r.post('/users',[
  body('full_name').trim().isLength({min:2,max:150}),
  body('username').trim().isLength({min:3,max:80}).matches(/^[A-Za-z0-9_.-]+$/),
  body('password').isLength({min:4,max:128}).matches(/^[A-Za-z0-9]+$/),
  body('role').isIn(['admin','owner']),
  body('email').optional({checkFalsy:true}).isEmail().isLength({max:150}),
  body('phone').optional({checkFalsy:true}).trim().isLength({min:6,max:30}).matches(/^[+0-9() .-]+$/),
  body('business_name').optional({checkFalsy:true}).trim().isLength({max:200}),
],validate,h(c.createUser));
r.put('/users/:id',[id(),
  body('full_name').optional().trim().isLength({min:2,max:150}),
  body('username').optional().trim().isLength({min:3,max:80}).matches(/^[A-Za-z0-9_.-]+$/),
  body('password').optional({checkFalsy:true}).isLength({min:4,max:128}).matches(/^[A-Za-z0-9]+$/),
  body('email').optional({checkFalsy:true}).isEmail().isLength({max:150}),
  body('phone').optional({checkFalsy:true}).trim().isLength({min:6,max:30}).matches(/^[+0-9() .-]+$/),
  body('business_name').optional({checkFalsy:true}).trim().isLength({max:200}),
],validate,h(c.updateUser));
r.delete('/users/:id',[id()],validate,h(c.deleteUser));
r.put('/platform-fees/:id/confirm',[id(),body('notes').optional().trim().isLength({max:500})],validate,h(c.confirmPlatformFee));
r.get('/generators',h(c.generators));
r.get('/settings',h(c.settings));
r.put('/settings/:key',[
  param('key').trim().matches(/^[a-z0-9_]{2,100}$/),
  body('value').exists().custom(v=>String(v).length<=500),
],validate,h(c.updateSetting));
r.get('/reports/summary',[query('month').optional().isInt({min:1,max:12}),query('year').optional().isInt({min:2020,max:2200})],validate,h(c.report));
r.get('/audit-logs',[query('limit').optional().isInt({min:1,max:1000})],validate,h(c.audit));
module.exports=r;
