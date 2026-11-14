'use strict';
const {query}=require('../database/connection');
async function log(d){try{return await query('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,method,route,ip_address,details_json) VALUES (?,?,?,?,?,?,?,?)',[d.user_id||null,d.action,d.entity_type||null,d.entity_id?String(d.entity_id):null,d.method||null,d.route||null,d.ip_address||null,d.details?JSON.stringify(d.details):null]);}catch(e){console.error('Audit log failed:',e.message);return null;}}
async function list({limit=200}={}){return query(`SELECT a.*,u.full_name,u.role FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT ?`,[Number(limit)]);}
module.exports={log,list};
