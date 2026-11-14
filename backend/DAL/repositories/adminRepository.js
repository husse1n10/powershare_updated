'use strict';
const {query,queryOne,transaction}=require('../database/connection');

async function getSettingValue(key){const row=await queryOne('SELECT setting_value FROM platform_settings WHERE setting_key=?',[key]);return row?.setting_value??null;}
async function activeSubscriberCounts(start,end){return query(`SELECT go.id owner_id,COUNT(DISTINCT CASE WHEN s.start_date<=? AND (s.end_date IS NULL OR s.end_date>=?) THEN s.subscriber_id END) subscriber_count
  FROM generator_owners go LEFT JOIN subscriptions s ON s.owner_id=go.id GROUP BY go.id`,[end,start]);}
async function upsertPlatformFeeCollections(month,year,rows){
  await transaction(async conn=>{
    for(const row of rows){
      await conn.execute(`INSERT INTO platform_fee_collections(owner_id,month,year,fee_per_subscriber_usd,subscriber_count,expected_amount_usd,status)
        VALUES (?,?,?,?,?,?,'pending') ON DUPLICATE KEY UPDATE
        fee_per_subscriber_usd=IF(status='pending',VALUES(fee_per_subscriber_usd),fee_per_subscriber_usd),
        subscriber_count=IF(status='pending',VALUES(subscriber_count),subscriber_count),
        expected_amount_usd=IF(status='pending',VALUES(expected_amount_usd),expected_amount_usd)`,
        [row.owner_id,month,year,row.fee_per_subscriber_usd,row.subscriber_count,row.expected_amount_usd]);
    }
  });
}
async function platformFeeSnapshot(month,year){
  const [rows,totals]=await Promise.all([
    query(`SELECT pfc.*,go.business_name,u.full_name owner_name,u.phone owner_phone,cu.full_name confirmed_by_name
      FROM platform_fee_collections pfc JOIN generator_owners go ON go.id=pfc.owner_id JOIN users u ON u.id=go.user_id
      LEFT JOIN users cu ON cu.id=pfc.confirmed_by WHERE pfc.month=? AND pfc.year=?
      ORDER BY pfc.expected_amount_usd DESC,u.full_name`,[month,year]),
    queryOne(`SELECT COALESCE(SUM(expected_amount_usd),0) total_amount_usd,
      COALESCE(SUM(CASE WHEN status='received' THEN expected_amount_usd ELSE 0 END),0) collected_amount_usd,
      COALESCE(SUM(CASE WHEN status='pending' THEN expected_amount_usd ELSE 0 END),0) pending_amount_usd
      FROM platform_fee_collections WHERE month=? AND year=?`,[month,year])
  ]);
  return {rows,totals:{total_amount_usd:Number(totals?.total_amount_usd||0),collected_amount_usd:Number(totals?.collected_amount_usd||0),pending_amount_usd:Number(totals?.pending_amount_usd||0)}};
}
async function confirmPlatformFee(id,userId,notes=null){
  const current=await queryOne('SELECT * FROM platform_fee_collections WHERE id=?',[id]);
  if(!current)return null;
  if(current.status==='received')return {alreadyReceived:true,collection:current};
  await query(`UPDATE platform_fee_collections SET status='received',received_at=NOW(),confirmed_by=?,notes=? WHERE id=? AND status='pending'`,[userId,notes||null,id]);
  return {alreadyReceived:false,collection:await queryOne(`SELECT pfc.*,cu.full_name confirmed_by_name FROM platform_fee_collections pfc LEFT JOIN users cu ON cu.id=pfc.confirmed_by WHERE pfc.id=?`,[id])};
}
async function dashboardBase(month,year){
  const [totals,billing,recent]=await Promise.all([
    queryOne(`SELECT (SELECT COUNT(*) FROM users WHERE role='owner' AND is_active=1) total_owners,(SELECT COUNT(*) FROM generators WHERE is_active=1) total_generators,(SELECT COUNT(*) FROM subscriber_profiles WHERE account_status='active') total_subscribers,(SELECT COUNT(*) FROM users WHERE role='collector' AND is_active=1) total_collectors,(SELECT COUNT(*) FROM subscriptions WHERE is_active=1) active_subscriptions`),
    queryOne(`SELECT COUNT(*) total_bills,SUM(status='paid') paid_bills,SUM(status IN ('unpaid','partially_paid')) open_bills,COALESCE(SUM(CASE WHEN combined_parent_bill_id IS NULL THEN total_ttc_lbp ELSE 0 END),0) total_billed_lbp,COALESCE((SELECT SUM(p.amount_lbp) FROM payments p WHERE p.status='completed' AND MONTH(p.paid_at)=? AND YEAR(p.paid_at)=?),0) total_collected_lbp,COALESCE(SUM(CASE WHEN status IN ('unpaid','partially_paid') THEN remaining_balance_lbp ELSE 0 END),0) outstanding_lbp FROM bills WHERE month=? AND year=?`,[month,year,month,year]),
    query(`SELECT b.id,b.invoice_number,b.month,b.year,b.status,b.amount_due_lbp AS amount,0 AS platform_fee,b.remaining_balance_lbp,sp.full_name subscriber_name,g.name generator_name FROM bills b JOIN subscriptions s ON s.id=b.subscription_id JOIN subscriber_profiles sp ON sp.id=s.subscriber_id JOIN plans p ON p.id=s.plan_id JOIN generators g ON g.id=p.generator_id ORDER BY b.generated_at DESC LIMIT 10`)
  ]);
  return {totals,billing,recent};
}
async function settings(){return query('SELECT setting_key,setting_value,description,updated_at FROM platform_settings ORDER BY setting_key');}
async function updateSetting(key,value){await query('INSERT INTO platform_settings(setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)',[key,String(value)]);return queryOne('SELECT * FROM platform_settings WHERE setting_key=?',[key]);}
async function reportSummary(month,year){
  const [platform,billing,payments,owners,paymentMethods,supportStatus,platformFees]=await Promise.all([
    queryOne(`SELECT (SELECT COUNT(*) FROM users WHERE is_active=1) active_users,
      (SELECT COUNT(*) FROM users WHERE role='owner' AND is_active=1) active_owners,
      (SELECT COUNT(*) FROM generators WHERE is_active=1) active_generators,
      (SELECT COUNT(*) FROM subscriptions WHERE is_active=1) active_subscriptions,
      (SELECT COUNT(*) FROM users WHERE role='collector' AND is_active=1) active_collectors,
      (SELECT COUNT(*) FROM support_tickets WHERE status IN ('open','in_progress')) open_support_tickets`),
    queryOne(`SELECT COUNT(*) bills_generated,COALESCE(SUM(CASE WHEN combined_parent_bill_id IS NULL THEN kwh_used ELSE 0 END),0) consumption_kwh,
      COALESCE(SUM(CASE WHEN combined_parent_bill_id IS NULL THEN total_ttc_lbp ELSE 0 END),0) current_charges_lbp,COALESCE(SUM(CASE WHEN combined_parent_bill_id IS NULL THEN total_usd ELSE 0 END),0) current_charges_usd,
      SUM(status='paid') paid_bills,SUM(status='unpaid') unpaid_bills,SUM(status='partially_paid') partially_paid_bills,
      SUM(status='waived') waived_bills,SUM(status='carried_forward') carried_forward_bills,
      SUM(status IN ('unpaid','partially_paid')) open_bills,SUM(is_fixed_amount=1) fixed_bills,SUM(is_fixed_amount=0) metered_bills,
      COALESCE(SUM(CASE WHEN status IN ('unpaid','partially_paid') THEN remaining_balance_lbp ELSE 0 END),0) outstanding_lbp,
      COALESCE(SUM(CASE WHEN status IN ('unpaid','partially_paid') THEN remaining_balance_usd ELSE 0 END),0) outstanding_usd,
      (SELECT COUNT(*) FROM meter_readings WHERE MONTH(reading_date)=? AND YEAR(reading_date)=?) meter_readings
      FROM bills WHERE month=? AND year=?`,[month,year,month,year]),
    queryOne(`SELECT COUNT(*) payments_count,COALESCE(SUM(amount_lbp),0) collected_lbp,COALESCE(SUM(amount_usd),0) collected_usd
      FROM payments WHERE status='completed' AND MONTH(paid_at)=? AND YEAR(paid_at)=?`,[month,year]),
    query(`SELECT go.id owner_id,COALESCE(go.business_name,u.full_name) owner_name,COUNT(DISTINCT CASE WHEN s.is_active=1 THEN s.id END) active_subscribers,
      COUNT(DISTINCT b.id) bills_generated,COALESCE(SUM(CASE WHEN b.combined_parent_bill_id IS NULL THEN b.total_ttc_lbp ELSE 0 END),0) current_charges_lbp,
      COALESCE(SUM(CASE WHEN b.status IN ('unpaid','partially_paid') THEN b.remaining_balance_lbp ELSE 0 END),0) outstanding_lbp,
      (SELECT COUNT(*) FROM generators g WHERE g.owner_id=go.id AND g.is_active=1) active_generators,
      (SELECT COUNT(*) FROM bill_collectors bc JOIN users cu ON cu.id=bc.user_id WHERE bc.owner_id=go.id AND bc.is_active=1 AND cu.is_active=1) active_collectors
      FROM generator_owners go JOIN users u ON u.id=go.user_id LEFT JOIN subscriptions s ON s.owner_id=go.id
      LEFT JOIN bills b ON b.subscription_id=s.id AND b.month=? AND b.year=? GROUP BY go.id ORDER BY current_charges_lbp DESC,owner_name`,[month,year]),
    query(`SELECT payment_method,COUNT(*) payments_count,COALESCE(SUM(amount_lbp),0) collected_lbp,COALESCE(SUM(amount_usd),0) collected_usd
      FROM payments WHERE status='completed' AND MONTH(paid_at)=? AND YEAR(paid_at)=?
      GROUP BY payment_method ORDER BY collected_lbp DESC,payment_method`,[month,year]),
    query(`SELECT status,COUNT(*) ticket_count FROM support_tickets GROUP BY status ORDER BY FIELD(status,'open','in_progress','resolved','closed')`),
    queryOne(`SELECT COUNT(*) owners_billed,COALESCE(SUM(expected_amount_usd),0) expected_usd,
      COALESCE(SUM(CASE WHEN status='received' THEN expected_amount_usd ELSE 0 END),0) received_usd,
      COALESCE(SUM(CASE WHEN status='pending' THEN expected_amount_usd ELSE 0 END),0) pending_usd
      FROM platform_fee_collections WHERE month=? AND year=?`,[month,year])
  ]);
  return {period:{month,year},platform,billing,payments,owners,payment_methods:paymentMethods,support_status:supportStatus,platform_fees:platformFees};
}
module.exports={getSettingValue,activeSubscriberCounts,upsertPlatformFeeCollections,platformFeeSnapshot,confirmPlatformFee,dashboardBase,settings,updateSetting,reportSummary};
