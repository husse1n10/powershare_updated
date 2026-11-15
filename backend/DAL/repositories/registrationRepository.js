'use strict';
const {query,queryOne,transaction}=require('../database/connection');
const AppError=require('../../utils/AppError');

const applicationSelect=`SELECT a.*,u.full_name,u.username,u.email,u.phone,
 g.name generator_name,g.location_name,go.business_name provider_name,
 sp.meter_number FROM registration_applications a JOIN users u ON u.id=a.user_id
 LEFT JOIN generators g ON g.id=a.generator_id LEFT JOIN generator_owners go ON go.id=g.owner_id
 LEFT JOIN subscriber_profiles sp ON sp.id=a.subscriber_id`;

async function listDestinations(){
  return query(`SELECT g.id,g.name,g.location_name,go.business_name provider_name
    FROM generators g JOIN generator_owners go ON go.id=g.owner_id
    JOIN users u ON u.id=go.user_id
    WHERE g.is_active=1 AND g.status='active' AND u.is_active=1 AND u.role='owner'
    ORDER BY g.location_name,g.name,g.id`);
}
async function getByUserId(userId){return queryOne(applicationSelect+' WHERE a.user_id=?',[userId]);}
async function getById(id,ownerUserId=null){
  return queryOne(applicationSelect+' WHERE a.id=?'+(ownerUserId===null?'':' AND go.user_id=?'),ownerUserId===null?[id]:[id,ownerUserId]);
}
async function listApplications(status='pending',ownerUserId=null){
  const conditions=["a.status<>'unselected'"],params=[];
  if(status!=='all'){conditions.push('a.status=?');params.push(status);}
  if(ownerUserId!==null){conditions.push('go.user_id=?');params.push(ownerUserId);}
  return query(applicationSelect+(conditions.length?' WHERE '+conditions.join(' AND '):'')+' ORDER BY a.created_at,a.id LIMIT 200',params);
}
async function plansForApplication(id){
  return query(`SELECT p.id,p.name,p.ampere FROM registration_applications a
    JOIN plans p ON p.generator_id=a.generator_id AND p.is_active=1
    WHERE a.id=? ORDER BY p.ampere,p.name`,[id]);
}
async function lockDestination(conn,generatorId){
  // The owner row is also locked: assignments for one provider cannot race
  // normalized meter uniqueness checks, even when they use different plans.
  const [rows]=await conn.execute(`SELECT g.id,g.owner_id,go.user_id owner_user_id,g.name,g.location_name
    FROM generators g JOIN generator_owners go ON go.id=g.owner_id
    JOIN users u ON u.id=go.user_id WHERE g.id=? AND g.is_active=1
    AND g.status='active' AND u.is_active=1 AND u.role='owner' FOR UPDATE`,[generatorId]);
  if(!rows[0])throw new AppError('The selected generator is no longer accepting applications. Choose another destination.',409,'DESTINATION_UNAVAILABLE');
  return rows[0];
}
async function createApplication(data){
  return transaction(async conn=>{
    const [user]=await conn.execute(`INSERT INTO users(full_name,username,email,phone,password_hash,role,is_active,preferred_language)
      VALUES (?,?,?,?,?,'subscriber',1,?)`,[data.full_name,data.username,data.email,data.phone,data.password_hash,data.preferred_language]);
    const [application]=await conn.execute(`INSERT INTO registration_applications(user_id,status)
      VALUES (?,'unselected')`,[user.insertId]);
    const [rows]=await conn.execute('SELECT id,full_name,username,email,phone,role,is_active,preferred_language FROM users WHERE id=?',[user.insertId]);
    return {user:rows[0],application_id:application.insertId,status:'unselected'};
  });
}
async function chooseDestination(userId,data){
  return transaction(async conn=>{
    const [rows]=await conn.execute(`SELECT a.id,a.status,u.full_name FROM registration_applications a
      JOIN users u ON u.id=a.user_id WHERE a.user_id=? AND u.is_active=1 AND u.role='subscriber' FOR UPDATE`,[userId]);
    const application=rows[0];
    if(!application)throw new AppError('Subscriber application not found',404,'APPLICATION_NOT_FOUND');
    if(application.status!=='unselected')throw new AppError('A generator has already been selected. Refresh your application.',409,'APPLICATION_ALREADY_SUBMITTED');
    const destination=await lockDestination(conn,data.generator_id);
    await conn.execute(`UPDATE registration_applications SET generator_id=?,location_address=?,status='pending'
      WHERE id=? AND status='unselected'`,[data.generator_id,data.location_address,application.id]);
    return {id:application.id,user_id:userId,full_name:application.full_name,owner_user_id:destination.owner_user_id,status:'pending'};
  });
}
async function assignMeter(id,data,actorId,normalizedMeter,ownerUserId=null){
  return transaction(async conn=>{
    const [apps]=await conn.execute(`SELECT a.*,u.full_name,u.phone,u.is_active,u.role
      FROM registration_applications a JOIN users u ON u.id=a.user_id
      JOIN generators g ON g.id=a.generator_id JOIN generator_owners go ON go.id=g.owner_id
      WHERE a.id=?${ownerUserId===null?'':' AND go.user_id=?'} FOR UPDATE`,ownerUserId===null?[id]:[id,ownerUserId]);
    const a=apps[0];
    if(!a)throw new AppError('Application not found',404,'APPLICATION_NOT_FOUND');
    if(a.status!=='pending')throw new AppError('This application already has a meter assignment',409,'APPLICATION_ALREADY_ASSIGNED');
    if(!a.is_active||a.role!=='subscriber')throw new AppError('The subscriber account is inactive',409,'APPLICATION_ACCOUNT_INACTIVE');
    const destination=await lockDestination(conn,a.generator_id);
    const [plans]=await conn.execute('SELECT id FROM plans WHERE id=? AND generator_id=? AND is_active=1 FOR UPDATE',[data.plan_id,a.generator_id]);
    if(!plans[0])throw new AppError('Choose an active plan belonging to the requested generator',422,'APPLICATION_PLAN_MISMATCH');
    const [linked]=await conn.execute('SELECT id FROM subscriber_profiles WHERE user_id=? FOR UPDATE',[a.user_id]);
    if(linked.length)throw new AppError('This user already has a subscriber profile',409,'ACCOUNT_ALREADY_LINKED');
    const [meters]=await conn.execute(`SELECT id FROM subscriber_profiles WHERE created_by_owner=?
      AND UPPER(REPLACE(REPLACE(REPLACE(REPLACE(meter_number,'-',''),' ',''),'.',''),'_',''))=? FOR UPDATE`,[destination.owner_id,normalizedMeter]);
    if(meters.length)throw new AppError('This meter number is already assigned by this provider',409,'METER_NUMBER_IN_USE');
    const [profile]=await conn.execute(`INSERT INTO subscriber_profiles(user_id,full_name,phone,location_address,meter_number,created_by_owner,account_status)
      VALUES (?,?,?,?,?,?,'active')`,[a.user_id,a.full_name,a.phone,a.location_address,data.meter_number,destination.owner_id]);
    const [subscription]=await conn.execute(`INSERT INTO subscriptions(subscriber_id,plan_id,owner_id,initial_kwh_consumed,start_date,is_active)
      VALUES (?,?,?,?,?,1)`,[profile.insertId,data.plan_id,destination.owner_id,data.initial_kwh_consumed,data.start_date]);
    const [updated]=await conn.execute(`UPDATE registration_applications SET status='assigned',subscriber_id=?,assigned_by=?,assigned_at=CURRENT_TIMESTAMP
      WHERE id=? AND status='pending'`,[profile.insertId,actorId,id]);
    if(updated.affectedRows!==1)throw new AppError('Application changed while assigning the meter. Refresh and try again.',409,'APPLICATION_CHANGED');
    return {id,user_id:a.user_id,status:'assigned',meter_number:data.meter_number,subscriber_id:profile.insertId,subscription_id:subscription.insertId};
  });
}
module.exports={listDestinations,getByUserId,getById,listApplications,plansForApplication,createApplication,chooseDestination,assignMeter};
