'use strict';
const {query,queryOne,transaction}=require('../database/connection');
async function listByOwner(ownerId){return query(`SELECT bc.*,u.full_name,u.username,u.email,u.phone,u.is_active,(SELECT COALESCE(SUM(CASE WHEN cl.tx_type IN ('bill_collection','adjustment') THEN cl.amount_lbp ELSE -cl.amount_lbp END),0) FROM collector_ledger cl WHERE cl.collector_id=bc.id) balance_lbp FROM bill_collectors bc JOIN users u ON u.id=bc.user_id WHERE bc.owner_id=? ORDER BY u.full_name`,[ownerId]);}
async function getByUserId(userId){return queryOne(`SELECT bc.*,u.full_name,u.username,u.phone,go.business_name FROM bill_collectors bc JOIN users u ON u.id=bc.user_id JOIN generator_owners go ON go.id=bc.owner_id WHERE bc.user_id=?`,[userId]);}
async function createProfile(ownerId,userId){const r=await query('INSERT INTO bill_collectors(owner_id,user_id) VALUES (?,?)',[ownerId,userId]);return queryOne('SELECT * FROM bill_collectors WHERE id=?',[r.insertId]);}
async function updateActive(ownerId,id,isActive){await query('UPDATE bill_collectors SET is_active=? WHERE id=? AND owner_id=?',[isActive?1:0,id,ownerId]);return queryOne('SELECT * FROM bill_collectors WHERE id=? AND owner_id=?',[id,ownerId]);}
async function listGeneratorAssignments(collectorId){return query('SELECT generator_id FROM collector_generator_assignments WHERE collector_id=?',[collectorId]);}
async function setGeneratorAssignments(ownerId,collectorId,generatorIds){return transaction(async conn=>{const [row]=await conn.execute('SELECT id FROM bill_collectors WHERE id=? AND owner_id=?',[collectorId,ownerId]);if(!row.length)return false;await conn.execute('DELETE FROM collector_generator_assignments WHERE collector_id=?',[collectorId]);for(const gid of generatorIds||[]){await conn.execute('INSERT IGNORE INTO collector_generator_assignments(collector_id,generator_id) SELECT ?,id FROM generators WHERE id=? AND owner_id=?',[collectorId,gid,ownerId]);}return true;});}
async function listSubscriberAssignments(collectorId){return query('SELECT subscriber_id FROM collector_subscriber_assignments WHERE collector_id=?',[collectorId]);}
async function setSubscriberAssignments(ownerId,collectorId,subscriberIds){return transaction(async conn=>{const [row]=await conn.execute('SELECT id FROM bill_collectors WHERE id=? AND owner_id=?',[collectorId,ownerId]);if(!row.length)return false;await conn.execute('DELETE FROM collector_subscriber_assignments WHERE collector_id=?',[collectorId]);for(const sid of subscriberIds||[]){await conn.execute('INSERT IGNORE INTO collector_subscriber_assignments(collector_id,subscriber_id) SELECT ?,id FROM subscriber_profiles WHERE id=? AND created_by_owner=?',[collectorId,sid,ownerId]);}return true;});}
async function addLedger(d,conn=null){const executor=conn||{execute:async(sql,p)=>[await query(sql,p)]};if(conn){const [r]=await conn.execute('INSERT INTO collector_ledger(collector_id,owner_id,tx_type,amount_lbp,bill_id,payment_id,settlement_id,created_by,note) VALUES (?,?,?,?,?,?,?,?,?)',[d.collector_id,d.owner_id,d.tx_type,d.amount_lbp,d.bill_id||null,d.payment_id||null,d.settlement_id||null,d.created_by,d.note||null]);return r.insertId;}const r=await query('INSERT INTO collector_ledger(collector_id,owner_id,tx_type,amount_lbp,bill_id,payment_id,settlement_id,created_by,note) VALUES (?,?,?,?,?,?,?,?,?)',[d.collector_id,d.owner_id,d.tx_type,d.amount_lbp,d.bill_id||null,d.payment_id||null,d.settlement_id||null,d.created_by,d.note||null]);return r.insertId;}
async function ledger(collectorId){return query('SELECT * FROM collector_ledger WHERE collector_id=? ORDER BY created_at DESC,id DESC',[collectorId]);}
async function balance(collectorId){const r=await queryOne(`SELECT COALESCE(SUM(CASE WHEN tx_type IN ('bill_collection','adjustment') THEN amount_lbp ELSE -amount_lbp END),0) balance_lbp FROM collector_ledger WHERE collector_id=?`,[collectorId]);return Number(r?.balance_lbp||0);}
async function listSettlements(ownerId,collectorId=null){const params=[ownerId];let extra='';if(collectorId){extra=' AND cs.collector_id=?';params.push(collectorId);}return query(`SELECT cs.*,u.id collector_user_id,u.full_name collector_name,cu.full_name confirmed_by_name FROM collector_settlements cs JOIN bill_collectors bc ON bc.id=cs.collector_id JOIN users u ON u.id=bc.user_id LEFT JOIN users cu ON cu.id=cs.confirmed_by WHERE cs.owner_id=?${extra} ORDER BY cs.requested_at DESC`,params);}
async function requestSettlement(collectorId,ownerId,amount,notes){return transaction(async conn=>{
  const [collectorRows]=await conn.execute('SELECT id FROM bill_collectors WHERE id=? AND owner_id=? AND is_active=1 FOR UPDATE',[collectorId,ownerId]);
  if(!collectorRows.length){const e=new Error('Collector not found or inactive');e.code='COLLECTOR_NOT_FOUND';throw e;}
  const [balanceRows]=await conn.execute(`SELECT COALESCE(SUM(CASE WHEN tx_type IN ('bill_collection','adjustment') THEN amount_lbp ELSE -amount_lbp END),0) balance_lbp FROM collector_ledger WHERE collector_id=?`,[collectorId]);
  const [pendingRows]=await conn.execute("SELECT COALESCE(SUM(amount_lbp),0) pending_lbp FROM collector_settlements WHERE collector_id=? AND owner_id=? AND status='pending'",[collectorId,ownerId]);
  const balance=Number(balanceRows[0]?.balance_lbp||0);
  const pending=Number(pendingRows[0]?.pending_lbp||0);
  const available=Math.max(0,balance-pending);
  if(Number(amount)>available+0.01){const e=new Error('Settlement request exceeds available collector balance');e.code='SETTLEMENT_REQUEST_CONFLICT';e.available=available;throw e;}
  const [r]=await conn.execute('INSERT INTO collector_settlements(collector_id,owner_id,amount_lbp,requested_notes) VALUES (?,?,?,?)',[collectorId,ownerId,amount,notes||null]);
  const [rows]=await conn.execute('SELECT * FROM collector_settlements WHERE id=?',[r.insertId]);
  return rows[0]||null;
});}
async function confirmSettlement(ownerId,id,userId,notes){return transaction(async conn=>{
  const [rows]=await conn.execute("SELECT * FROM collector_settlements WHERE id=? AND owner_id=? AND status='pending' FOR UPDATE",[id,ownerId]);
  if(!rows.length)return null;
  const s=rows[0];
  // Lock the collector row so concurrent settlement confirmations for the same
  // collector are serialized before calculating the available ledger balance.
  await conn.execute('SELECT id FROM bill_collectors WHERE id=? AND owner_id=? FOR UPDATE',[s.collector_id,ownerId]);
  const [balanceRows]=await conn.execute(`SELECT COALESCE(SUM(CASE WHEN tx_type IN ('bill_collection','adjustment') THEN amount_lbp ELSE -amount_lbp END),0) balance_lbp FROM collector_ledger WHERE collector_id=?`,[s.collector_id]);
  const available=Number(balanceRows[0]?.balance_lbp||0);
  if(Number(s.amount_lbp)>available+0.01){const e=new Error('Settlement exceeds collector balance');e.code='SETTLEMENT_CONFLICT';throw e;}
  await conn.execute("UPDATE collector_settlements SET status='confirmed',confirmed_at=NOW(),confirmed_by=?,confirmation_notes=? WHERE id=?",[userId,notes||null,id]);
  await conn.execute('INSERT INTO collector_ledger(collector_id,owner_id,tx_type,amount_lbp,settlement_id,created_by,note) VALUES (?,?,\'owner_settlement\',?,?,?,?)',[s.collector_id,ownerId,s.amount_lbp,id,userId,notes||null]);
  return s;
});}
async function rejectSettlement(ownerId,id,userId,notes){const r=await query("UPDATE collector_settlements SET status='rejected',confirmed_at=NOW(),confirmed_by=?,confirmation_notes=? WHERE id=? AND owner_id=? AND status='pending'",[userId,notes||null,id,ownerId]);if(!r||r.affectedRows!==1)return null;return queryOne('SELECT * FROM collector_settlements WHERE id=? AND owner_id=?',[id,ownerId]);}

async function ownerTotals(ownerId){return queryOne(`SELECT
COALESCE(SUM(CASE WHEN tx_type IN ('bill_collection','adjustment') THEN amount_lbp ELSE 0 END),0) collected_lbp,
COALESCE(SUM(CASE WHEN tx_type='owner_settlement' THEN amount_lbp ELSE 0 END),0) transferred_lbp,
COALESCE(SUM(CASE WHEN tx_type IN ('bill_collection','adjustment') THEN amount_lbp ELSE -amount_lbp END),0) available_lbp
FROM collector_ledger WHERE owner_id=?`,[ownerId]);}

async function walletSummary(collectorId){
  const row=await queryOne(`SELECT
    COALESCE(SUM(CASE WHEN tx_type IN ('bill_collection','adjustment') THEN amount_lbp ELSE 0 END),0) collected_lbp,
    COALESCE(SUM(CASE WHEN tx_type='owner_settlement' THEN amount_lbp ELSE 0 END),0) transferred_lbp,
    COALESCE(SUM(CASE WHEN tx_type IN ('bill_collection','adjustment') THEN amount_lbp ELSE -amount_lbp END),0) balance_lbp,
    (SELECT COALESCE(SUM(amount_lbp),0) FROM collector_settlements WHERE collector_id=? AND status='pending') pending_lbp,
    (SELECT COUNT(*) FROM collector_settlements WHERE collector_id=? AND status='pending') pending_count
    FROM collector_ledger WHERE collector_id=?`,[collectorId,collectorId,collectorId]);
  const result=Object.fromEntries(Object.entries(row).map(([key,value])=>[key,Number(value||0)]));
  return {...result,available_lbp:Math.round((result.balance_lbp-result.pending_lbp)*100)/100};
}

async function listAssignedSubscribers(collectorId){return query(`SELECT DISTINCT sp.*,sp.id subscriber_id,s.id subscription_id,s.initial_kwh_consumed,s.fixed_amount_enabled,s.fixed_amount_usd,p.name plan_name,p.ampere,g.id generator_id,g.name generator_name,(SELECT mr.reading_value FROM meter_readings mr WHERE mr.subscription_id=s.id ORDER BY mr.reading_date DESC,mr.id DESC LIMIT 1) last_reading_value FROM bill_collectors bc JOIN generators g ON g.owner_id=bc.owner_id JOIN plans p ON p.generator_id=g.id JOIN subscriptions s ON s.plan_id=p.id AND s.is_active=1 JOIN subscriber_profiles sp ON sp.id=s.subscriber_id LEFT JOIN collector_generator_assignments cga ON cga.collector_id=bc.id AND cga.generator_id=g.id LEFT JOIN collector_subscriber_assignments csa ON csa.collector_id=bc.id AND csa.subscriber_id=sp.id WHERE bc.id=? AND (cga.id IS NOT NULL OR csa.id IS NOT NULL OR (NOT EXISTS(SELECT 1 FROM collector_generator_assignments x WHERE x.collector_id=bc.id) AND NOT EXISTS(SELECT 1 FROM collector_subscriber_assignments y WHERE y.collector_id=bc.id))) ORDER BY sp.full_name`,[collectorId]);}
module.exports={walletSummary,ownerTotals,listAssignedSubscribers,listByOwner,getByUserId,createProfile,updateActive,listGeneratorAssignments,setGeneratorAssignments,listSubscriberAssignments,setSubscriberAssignments,addLedger,ledger,balance,listSettlements,requestSettlement,confirmSettlement,rejectSettlement};
