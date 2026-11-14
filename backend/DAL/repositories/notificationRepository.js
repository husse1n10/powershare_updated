'use strict';
const {query,queryOne}=require('../database/connection');
async function create(userId,type,title,message,actionUrl=null){const r=await query('INSERT INTO notifications(user_id,type,title,message,action_url) VALUES (?,?,?,?,?)',[userId,type,title,message,actionUrl]);return queryOne('SELECT * FROM notifications WHERE id=?',[r.insertId]);}
async function list(userId,limit=50){return query('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT ?',[userId,Number(limit)]);}
async function unreadCount(userId){const r=await queryOne('SELECT COUNT(*) count FROM notifications WHERE user_id=? AND is_read=0',[userId]);return Number(r?.count||0);}
async function markRead(userId,id){await query('UPDATE notifications SET is_read=1,read_at=NOW() WHERE id=? AND user_id=?',[id,userId]);return queryOne('SELECT * FROM notifications WHERE id=? AND user_id=?',[id,userId]);}
async function markAllRead(userId){return query('UPDATE notifications SET is_read=1,read_at=NOW() WHERE user_id=? AND is_read=0',[userId]);}
async function adminUserIds(){return query("SELECT id user_id FROM users WHERE role='admin' AND is_active=1");}
async function userIdsForOwnerSubscribers(ownerId){return query(`SELECT DISTINCT sp.user_id FROM subscriber_profiles sp JOIN subscriptions s ON s.subscriber_id=sp.id WHERE s.owner_id=? AND sp.user_id IS NOT NULL AND s.is_active=1`,[ownerId]);}
async function userIdsForGeneratorSubscribers(generatorId){return query(`SELECT DISTINCT sp.user_id FROM subscriber_profiles sp JOIN subscriptions s ON s.subscriber_id=sp.id JOIN plans p ON p.id=s.plan_id WHERE p.generator_id=? AND sp.user_id IS NOT NULL AND s.is_active=1`,[generatorId]);}
module.exports={create,list,unreadCount,markRead,markAllRead,adminUserIds,userIdsForOwnerSubscribers,userIdsForGeneratorSubscribers};
