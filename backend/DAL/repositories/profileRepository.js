'use strict';
const { query, queryOne } = require('../database/connection');
async function getOwnerByUserId(userId){ return queryOne('SELECT * FROM generator_owners WHERE user_id=?',[userId]); }
async function getOwnerById(id){ return queryOne('SELECT * FROM generator_owners WHERE id=?',[id]); }
async function getCollectorByUserId(userId){ return queryOne(`SELECT bc.*,u.full_name,u.username,u.email,u.phone,u.is_active user_is_active,u.preferred_language
  FROM bill_collectors bc JOIN users u ON u.id=bc.user_id WHERE bc.user_id=?`,[userId]); }
async function getSubscriberByUserId(userId){ return queryOne('SELECT * FROM subscriber_profiles WHERE user_id=?',[userId]); }
async function createOwner(userId, data={}) { const r=await query('INSERT INTO generator_owners(user_id,business_name,company_address) VALUES (?,?,?)',[userId,data.business_name||null,data.company_address||null]); return queryOne('SELECT * FROM generator_owners WHERE id=?',[r.insertId]); }

async function updateOwnerByUserId(userId,data={}){
  const allowed=['business_name','company_name','company_address','company_street','company_city','capital_lbp','fiscal_number','registry_number','phone2'];
  const keys=Object.keys(data).filter(k=>allowed.includes(k));
  if(keys.length)await query(`UPDATE generator_owners SET ${keys.map(k=>`${k}=?`).join(',')} WHERE user_id=?`,[...keys.map(k=>data[k]),userId]);
  return getOwnerByUserId(userId);
}
async function createCollector(userId, ownerId){ const r=await query('INSERT INTO bill_collectors(owner_id,user_id) VALUES (?,?)',[ownerId,userId]); return queryOne('SELECT * FROM bill_collectors WHERE id=?',[r.insertId]); }
async function createSubscriberProfile(userId, ownerId, data){ const r=await query(`INSERT INTO subscriber_profiles(user_id,full_name,phone,location_address,meter_number,main_meter_id,created_by_owner,account_status)
VALUES (?,?,?,?,?,?,?,?)`,[userId||null,data.full_name,data.phone||null,data.location_address,data.meter_number||null,data.main_meter_id||null,ownerId,data.account_status||'active']); return queryOne('SELECT * FROM subscriber_profiles WHERE id=?',[r.insertId]); }
async function linkSubscriberUser(profileId,userId){ await query('UPDATE subscriber_profiles SET user_id=? WHERE id=?',[userId,profileId]); return queryOne('SELECT * FROM subscriber_profiles WHERE id=?',[profileId]); }
module.exports={getOwnerByUserId,getOwnerById,getCollectorByUserId,getSubscriberByUserId,createOwner,updateOwnerByUserId,createCollector,createSubscriberProfile,linkSubscriberUser};
