'use strict';
const {query,queryOne,transaction}=require('../database/connection');
// Optional filters {month,year,status}; status 'unpaid' means any open (payable) invoice.
function billFilterSql(filters={}){const where=[];const params=[];
  if(filters.month&&filters.year){where.push('b.month=? AND b.year=?');params.push(Number(filters.month),Number(filters.year));}
  if(filters.status==='unpaid')where.push("b.status IN ('unpaid','partially_paid')");else if(filters.status){where.push('b.status=?');params.push(String(filters.status));}
  return {sql:where.length?` AND ${where.join(' AND ')}`:'',params};}
async function listByOwner(ownerId,filters={}){const f=billFilterSql(filters);return query(`SELECT b.*,CASE WHEN b.combined_meta_json IS NOT NULL THEN 1 ELSE 0 END is_combined_invoice,sp.full_name subscriber_name,sp.meter_number,p.name plan_name,p.ampere,g.name generator_name
FROM bills b JOIN subscriptions s ON s.id=b.subscription_id JOIN subscriber_profiles sp ON sp.id=s.subscriber_id JOIN plans p ON p.id=s.plan_id JOIN generators g ON g.id=p.generator_id WHERE s.owner_id=?${f.sql} ORDER BY b.year DESC,b.month DESC,b.generated_at DESC`,[ownerId,...f.params]);}
async function getBillForOwner(ownerId,id){return queryOne(`SELECT b.*,CASE WHEN b.combined_meta_json IS NOT NULL THEN 1 ELSE 0 END is_combined_invoice,sp.id subscriber_id,sp.full_name subscriber_name,sp.user_id subscriber_user_id,sp.phone subscriber_phone,sp.location_address subscriber_address,sp.meter_number,s.initial_kwh_consumed,s.owner_id,p.name plan_name,p.ampere,g.id generator_id,g.name generator_name,g.location_name generator_location,mr.previous_value prev_reading,mr.reading_value current_reading
FROM bills b JOIN subscriptions s ON s.id=b.subscription_id JOIN subscriber_profiles sp ON sp.id=s.subscriber_id JOIN plans p ON p.id=s.plan_id JOIN generators g ON g.id=p.generator_id LEFT JOIN meter_readings mr ON mr.id=b.meter_reading_id WHERE b.id=? AND s.owner_id=?`,[id,ownerId]);}
async function getBill(id){return queryOne(`SELECT b.*,CASE WHEN b.combined_meta_json IS NOT NULL THEN 1 ELSE 0 END is_combined_invoice,sp.id subscriber_id,sp.full_name subscriber_name,sp.user_id subscriber_user_id,sp.phone subscriber_phone,sp.location_address subscriber_address,sp.meter_number,s.initial_kwh_consumed,s.owner_id,p.name plan_name,p.ampere,g.id generator_id,g.name generator_name,g.location_name generator_location,mr.previous_value prev_reading,mr.reading_value current_reading FROM bills b JOIN subscriptions s ON s.id=b.subscription_id JOIN subscriber_profiles sp ON sp.id=s.subscriber_id JOIN plans p ON p.id=s.plan_id JOIN generators g ON g.id=p.generator_id LEFT JOIN meter_readings mr ON mr.id=b.meter_reading_id WHERE b.id=?`,[id]);}
async function previousBill(subscriptionId,month,year){return queryOne(`SELECT * FROM bills WHERE subscription_id=? AND (year<? OR (year=? AND month<?)) ORDER BY year DESC,month DESC,id DESC LIMIT 1`,[subscriptionId,year,year,month]);}
async function getForPeriod(subscriptionId,month,year){return queryOne('SELECT * FROM bills WHERE subscription_id=? AND month=? AND year=?',[subscriptionId,month,year]);}
async function listBillsByIdsForOwner(ownerId,billIds){
  const ids=[...new Set((billIds||[]).map(Number).filter(x=>Number.isInteger(x)&&x>0))];
  if(!ids.length)return [];
  const ph=ids.map(()=>'?').join(',');
  return query(`SELECT b.*,s.owner_id,sp.full_name subscriber_name FROM bills b JOIN subscriptions s ON s.id=b.subscription_id JOIN subscriber_profiles sp ON sp.id=s.subscriber_id WHERE s.owner_id=? AND b.id IN (${ph}) ORDER BY b.year DESC,b.month DESC,b.id DESC`,[ownerId,...ids]);
}
async function createBill(d,{carryFromBillId=null}={}){
  const billId=await transaction(async conn=>{
    const [r]=await conn.execute(`INSERT INTO bills(subscription_id,invoice_number,month,year,meter_reading_id,kwh_used,is_fixed_amount,fixed_amount_usd,base_amount_lbp,maintenance_lbp,total_ht_lbp,vat_rate,vat_amount_lbp,total_ttc_lbp,usd_lbp_rate,total_usd,previous_balance_lbp,previous_balance_usd,amount_due_lbp,amount_due_usd,amount_received_lbp,amount_received_usd,remaining_balance_lbp,remaining_balance_usd,status,notes,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [d.subscription_id,d.invoice_number,d.month,d.year,d.meter_reading_id||null,d.kwh_used||0,d.is_fixed_amount?1:0,d.fixed_amount_usd||0,d.base_amount_lbp||0,d.maintenance_lbp||0,d.total_ht_lbp||0,d.vat_rate||0,d.vat_amount_lbp||0,d.total_ttc_lbp||0,d.usd_lbp_rate,d.total_usd||0,d.previous_balance_lbp||0,d.previous_balance_usd||0,d.amount_due_lbp||0,d.amount_due_usd||0,0,0,d.amount_due_lbp||0,d.amount_due_usd||0,d.status||'unpaid',d.notes||null,d.created_by]);
    if(d.status==='paid')await conn.execute('UPDATE bills SET paid_at=NOW() WHERE id=?',[r.insertId]);
    if(carryFromBillId){
      const [carryResult]=await conn.execute(`UPDATE bills SET status='carried_forward',carried_forward_to_bill_id=?
        WHERE id=? AND subscription_id=? AND status IN ('unpaid','partially_paid') AND (remaining_balance_lbp>0.01 OR remaining_balance_usd>0.01)`,
        [r.insertId,carryFromBillId,d.subscription_id]);
      if(carryResult.affectedRows!==1){const e=new Error('Previous bill changed while balance was being carried forward');e.code='CARRY_FORWARD_CONFLICT';throw e;}
    }
    return r.insertId;
  });
  return getBill(billId);
}
async function recordPaymentAndUpdateBill({bill,payment,collectorId=null,recordedBy}){
  return transaction(async conn=>{
    // Optimistic concurrency check: only update if no other payment changed the
    // bill after the BLL calculated this payment. This prevents double payment
    // when two collectors/devices submit at the same time.
    const [ur]=await conn.execute(`UPDATE bills SET amount_received_lbp=?,amount_received_usd=?,remaining_balance_lbp=?,remaining_balance_usd=?,status=?,paid_at=IF(?='paid',NOW(),paid_at)
      WHERE id=? AND status IN ('unpaid','partially_paid') AND amount_received_lbp=? AND amount_received_usd=?`,
      [payment.amountReceivedLbp,payment.amountReceivedUsd,payment.remainingBalanceLbp,payment.remainingBalanceUsd,payment.status,payment.status,bill.id,Number(bill.amount_received_lbp||0),Number(bill.amount_received_usd||0)]);
    if(ur.affectedRows!==1){const e=new Error('Bill changed while payment was being processed');e.code='PAYMENT_CONFLICT';throw e;}
    const [pr]=await conn.execute(`INSERT INTO payments(bill_id,subscriber_id,owner_id,collector_id,amount_usd,amount_lbp,usd_lbp_rate,payment_method,transaction_reference,status,recorded_by,notes) VALUES (?,?,?,?,?,?,?,?,?,'completed',?,?)`,
      [bill.id,bill.subscriber_id,bill.owner_id,collectorId,payment.paymentAmountUsd,payment.paymentAmountLbp,bill.usd_lbp_rate,payment.payment_method||'cash',payment.transaction_reference||null,recordedBy,payment.notes||null]);
    if(collectorId){
      await conn.execute(`INSERT INTO collector_ledger(collector_id,owner_id,tx_type,amount_lbp,bill_id,payment_id,created_by,note) VALUES (?,?,'bill_collection',?,?,?,?,?)`,
        [collectorId,bill.owner_id,payment.paymentAmountLbp,bill.id,pr.insertId,recordedBy,`Payment ${pr.insertId}`]);
    }
    return pr.insertId;
  });
}
async function listPaymentsByOwner(ownerId){return query(`SELECT pay.*,b.invoice_number,sp.full_name subscriber_name,u.full_name recorded_by_name,cu.full_name collector_name FROM payments pay JOIN bills b ON b.id=pay.bill_id JOIN subscriber_profiles sp ON sp.id=pay.subscriber_id JOIN users u ON u.id=pay.recorded_by LEFT JOIN bill_collectors bc ON bc.id=pay.collector_id LEFT JOIN users cu ON cu.id=bc.user_id WHERE pay.owner_id=? ORDER BY pay.paid_at DESC`,[ownerId]);}
async function listBillsBySubscriberUser(userId){return query(`SELECT b.*,g.name generator_name,p.name plan_name,p.ampere FROM subscriber_profiles sp JOIN subscriptions s ON s.subscriber_id=sp.id JOIN bills b ON b.subscription_id=s.id JOIN plans p ON p.id=s.plan_id JOIN generators g ON g.id=p.generator_id WHERE sp.user_id=? ORDER BY b.year DESC,b.month DESC`,[userId]);}
async function getBillBySubscriberUser(userId,billId){return queryOne(`SELECT b.*,CASE WHEN b.combined_meta_json IS NOT NULL THEN 1 ELSE 0 END is_combined_invoice,s.owner_id,g.id generator_id,g.name generator_name,g.location_name generator_location,p.name plan_name,p.ampere,sp.id subscriber_id,sp.full_name subscriber_name,sp.phone subscriber_phone,sp.location_address subscriber_address,sp.meter_number,s.initial_kwh_consumed,mr.previous_value prev_reading,mr.reading_value current_reading FROM subscriber_profiles sp JOIN subscriptions s ON s.subscriber_id=sp.id JOIN bills b ON b.subscription_id=s.id JOIN plans p ON p.id=s.plan_id JOIN generators g ON g.id=p.generator_id LEFT JOIN meter_readings mr ON mr.id=b.meter_reading_id WHERE sp.user_id=? AND b.id=?`,[userId,billId]);}
async function listPaymentsBySubscriberUser(userId){return query(`SELECT pay.*,b.invoice_number,b.month,b.year FROM subscriber_profiles sp JOIN payments pay ON pay.subscriber_id=sp.id JOIN bills b ON b.id=pay.bill_id WHERE sp.user_id=? ORDER BY pay.paid_at DESC`,[userId]);}
async function listBillsForCollector(collectorId,filters={}){const f=billFilterSql(filters);return query(`SELECT DISTINCT b.*,CASE WHEN b.combined_meta_json IS NOT NULL THEN 1 ELSE 0 END is_combined_invoice,sp.full_name subscriber_name,sp.phone,sp.meter_number,g.name generator_name,p.name plan_name FROM bill_collectors bc JOIN generators g ON g.owner_id=bc.owner_id JOIN plans p ON p.generator_id=g.id JOIN subscriptions s ON s.plan_id=p.id JOIN subscriber_profiles sp ON sp.id=s.subscriber_id JOIN bills b ON b.subscription_id=s.id LEFT JOIN collector_generator_assignments cga ON cga.collector_id=bc.id AND cga.generator_id=g.id LEFT JOIN collector_subscriber_assignments csa ON csa.collector_id=bc.id AND csa.subscriber_id=sp.id WHERE bc.id=? AND (cga.id IS NOT NULL OR csa.id IS NOT NULL OR (NOT EXISTS(SELECT 1 FROM collector_generator_assignments x WHERE x.collector_id=bc.id) AND NOT EXISTS(SELECT 1 FROM collector_subscriber_assignments y WHERE y.collector_id=bc.id)))${f.sql} ORDER BY b.year DESC,b.month DESC`,[collectorId,...f.params]);}

async function isReadingBilled(readingId){const r=await queryOne('SELECT id FROM bills WHERE meter_reading_id=? LIMIT 1',[readingId]);return !!r;}

// DEF-053: deletion runs under a row lock, refuses invoices that other invoices
// depend on, and restores any balance that had been carried into the deleted invoice.
async function deleteBill(ownerId,id){
  return transaction(async conn=>{
    const [rows]=await conn.execute(`SELECT b.id,b.subscription_id,b.status,b.combined_meta_json,b.combined_parent_bill_id FROM bills b JOIN subscriptions s ON s.id=b.subscription_id WHERE b.id=? AND s.owner_id=? FOR UPDATE`,[id,ownerId]);
    const bill=rows[0]; if(!bill)return null;
    const [[pay]]=await conn.execute('SELECT COUNT(*) c FROM payments WHERE bill_id=?',[id]);
    if(Number(pay.c)>0)return {blocked:'Bill has payment history'};
    const [[merged]]=await conn.execute('SELECT COUNT(*) c FROM bills WHERE combined_parent_bill_id=?',[id]);
    if(bill.combined_meta_json||Number(merged.c)>0)return {blocked:'Combined invoices cannot be deleted because merged invoices depend on them'};
    if(bill.combined_parent_bill_id||bill.status==='waived')return {blocked:'This invoice was merged into a combined invoice and cannot be deleted'};
    if(bill.status==='carried_forward')return {blocked:'This invoice balance was carried into a later invoice and cannot be deleted'};
    await conn.execute(`UPDATE bills SET status=IF(amount_received_lbp>0.01,'partially_paid','unpaid'),carried_forward_to_bill_id=NULL WHERE carried_forward_to_bill_id=? AND subscription_id=? AND status='carried_forward'`,[id,bill.subscription_id]);
    await conn.execute('DELETE FROM bills WHERE id=?',[id]);
    return {deleted:true};
  });
}

// DEF-052: candidates are re-read and validated under row locks inside the
// transaction, so a payment that lands between validation and update cannot be lost.
async function combineBills(ownerId,billIds){
  const ids=[...new Set((billIds||[]).map(Number).filter(x=>Number.isInteger(x)&&x>0))];
  if(ids.length<2)return {error:'Select at least 2 bills to combine'};
  const ph=ids.map(()=>'?').join(',');
  const result=await transaction(async conn=>{
    const [rows]=await conn.execute(`SELECT b.*,s.owner_id,sp.full_name subscriber_name,p.ampere,g.name generator_name,mr.previous_value prev_reading,mr.reading_value current_reading FROM bills b JOIN subscriptions s ON s.id=b.subscription_id JOIN subscriber_profiles sp ON sp.id=s.subscriber_id JOIN plans p ON p.id=s.plan_id JOIN generators g ON g.id=p.generator_id LEFT JOIN meter_readings mr ON mr.id=b.meter_reading_id WHERE s.owner_id=? AND b.id IN (${ph}) ORDER BY b.year DESC,b.month DESC,b.id DESC FOR UPDATE OF b`,[ownerId,...ids]);
    if(rows.length!==ids.length)return {error:'Some bills were not found'};
    if(rows.some(x=>!['unpaid','partially_paid'].includes(x.status)))return {error:'Only open unpaid bills can be combined'};
    if(rows.some(x=>Number(x.amount_received_lbp||0)>0.01||Number(x.amount_received_usd||0)>0.01))return {error:'Invoices that already have payments cannot be combined'};
    const subId=Number(rows[0].subscription_id); if(rows.some(x=>Number(x.subscription_id)!==subId))return {error:'Selected bills must belong to the same subscriber'};
    if(rows.some(x=>Math.abs(Number(x.previous_balance_lbp||0))>0.01||Math.abs(Number(x.previous_balance_usd||0))>0.01))return {error:'Bills that include a previous balance cannot be combined'};
    const primary=rows[0], merged=rows.slice(1);
    const totals=rows.reduce((a,b)=>{for(const k of Object.keys(a))a[k]+=Number(b[k]||0);return a;},{kwh_used:0,base_amount_lbp:0,maintenance_lbp:0,total_ht_lbp:0,vat_amount_lbp:0,total_ttc_lbp:0,total_usd:0,amount_due_lbp:0,amount_due_usd:0});
    const meta=JSON.stringify({version:2,source_bill_ids:rows.map(x=>x.id),items:rows.map(x=>({bill_id:x.id,invoice_number:x.invoice_number,month:x.month,year:x.year,kwh_used:Number(x.kwh_used||0),is_fixed_amount:Number(x.is_fixed_amount||0),fixed_amount_usd:Number(x.fixed_amount_usd||0),base_amount_lbp:Number(x.base_amount_lbp||0),maintenance_lbp:Number(x.maintenance_lbp||0),total_ht_lbp:Number(x.total_ht_lbp||0),vat_rate:Number(x.vat_rate||0),vat_amount_lbp:Number(x.vat_amount_lbp||0),total_ttc_lbp:Number(x.total_ttc_lbp||0),total_usd:Number(x.total_usd||0),amount_due_lbp:Number(x.amount_due_lbp||0),amount_due_usd:Number(x.amount_due_usd||0),prev_reading:x.prev_reading==null?null:Number(x.prev_reading),current_reading:x.current_reading==null?null:Number(x.current_reading),ampere:Number(x.ampere||0),generator_name:x.generator_name||null}))});
    const r2=v=>Math.round(v*100)/100;
    // No payments exist on any source invoice, so remaining balance == amount due.
    await conn.execute(`UPDATE bills SET kwh_used=?,base_amount_lbp=?,maintenance_lbp=?,total_ht_lbp=?,vat_amount_lbp=?,total_ttc_lbp=?,total_usd=?,previous_balance_lbp=0,previous_balance_usd=0,amount_due_lbp=?,amount_due_usd=?,amount_received_lbp=0,amount_received_usd=0,remaining_balance_lbp=?,remaining_balance_usd=?,combined_meta_json=?,notes=CONCAT(COALESCE(notes,''),IF(COALESCE(notes,'')='','',' | '),'Combined invoice') WHERE id=?`,[r2(totals.kwh_used),r2(totals.base_amount_lbp),r2(totals.maintenance_lbp),r2(totals.total_ht_lbp),r2(totals.vat_amount_lbp),r2(totals.total_ttc_lbp),r2(totals.total_usd),r2(totals.amount_due_lbp),r2(totals.amount_due_usd),r2(totals.amount_due_lbp),r2(totals.amount_due_usd),meta,primary.id]);
    for(const b of merged)await conn.execute("UPDATE bills SET status='waived',combined_parent_bill_id=?,notes=CONCAT(COALESCE(notes,''),IF(COALESCE(notes,'')='','',' | '),'Merged into invoice') WHERE id=?",[primary.id,b.id]);
    return {id:primary.id};
  });
  if(result.error)return result;
  return getBillForOwner(ownerId,result.id);
}

async function listRecentOwnerStats(ownerId){return queryOne(`SELECT COUNT(*) total_bills,SUM(status='paid') paid_bills,SUM(status IN ('unpaid','partially_paid')) open_bills,COALESCE(SUM(CASE WHEN combined_parent_bill_id IS NULL THEN total_ttc_lbp ELSE 0 END),0) total_billed_lbp,COALESCE((SELECT SUM(p.amount_lbp) FROM payments p WHERE p.owner_id=? AND p.status='completed'),0) collected_lbp,COALESCE(SUM(CASE WHEN status IN ('unpaid','partially_paid') THEN remaining_balance_lbp ELSE 0 END),0) remaining_lbp FROM bills b JOIN subscriptions s ON s.id=b.subscription_id WHERE s.owner_id=?`,[ownerId,ownerId]);}
async function ownerReportPeriod(ownerId,month,year){
  const [billing,payments,generators,paymentMethods,collectors,outstandingAccounts]=await Promise.all([
    queryOne(`SELECT COUNT(*) bills_generated,COALESCE(SUM(CASE WHEN b.combined_parent_bill_id IS NULL THEN b.kwh_used ELSE 0 END),0) consumption_kwh,
      COALESCE(SUM(CASE WHEN b.combined_parent_bill_id IS NULL THEN b.total_ttc_lbp ELSE 0 END),0) current_charges_lbp,COALESCE(SUM(CASE WHEN b.combined_parent_bill_id IS NULL THEN b.total_usd ELSE 0 END),0) current_charges_usd,
      SUM(b.status='paid') paid_bills,SUM(b.status='unpaid') unpaid_bills,SUM(b.status='partially_paid') partially_paid_bills,
      SUM(b.status='waived') waived_bills,SUM(b.status='carried_forward') carried_forward_bills,
      SUM(b.status IN ('unpaid','partially_paid')) open_bills,
      SUM(b.is_fixed_amount=1) fixed_bills,SUM(b.is_fixed_amount=0) metered_bills,
      COALESCE(SUM(CASE WHEN b.status IN ('unpaid','partially_paid') THEN b.remaining_balance_lbp ELSE 0 END),0) outstanding_lbp,
      COALESCE(SUM(CASE WHEN b.status IN ('unpaid','partially_paid') THEN b.remaining_balance_usd ELSE 0 END),0) outstanding_usd
      FROM bills b JOIN subscriptions s ON s.id=b.subscription_id WHERE s.owner_id=? AND b.month=? AND b.year=?`,[ownerId,month,year]),
    queryOne(`SELECT COUNT(*) payments_count,COALESCE(SUM(amount_lbp),0) collected_lbp,COALESCE(SUM(amount_usd),0) collected_usd
      FROM payments WHERE owner_id=? AND status='completed' AND MONTH(paid_at)=? AND YEAR(paid_at)=?`,[ownerId,month,year]),
    query(`SELECT g.id,g.name,g.location_name,g.total_kw,g.max_amperage,
      COUNT(DISTINCT CASE WHEN s.is_active=1 THEN s.id END) active_subscribers,
      COUNT(DISTINCT b.id) bills_generated,COALESCE(SUM(CASE WHEN b.combined_parent_bill_id IS NULL THEN b.kwh_used ELSE 0 END),0) consumption_kwh,
      COALESCE(SUM(CASE WHEN b.combined_parent_bill_id IS NULL THEN b.total_ttc_lbp ELSE 0 END),0) current_charges_lbp,
      COALESCE(SUM(CASE WHEN b.status IN ('unpaid','partially_paid') THEN b.remaining_balance_lbp ELSE 0 END),0) outstanding_lbp
      FROM generators g LEFT JOIN plans p ON p.generator_id=g.id LEFT JOIN subscriptions s ON s.plan_id=p.id
      LEFT JOIN bills b ON b.subscription_id=s.id AND b.month=? AND b.year=?
      WHERE g.owner_id=? GROUP BY g.id ORDER BY current_charges_lbp DESC,g.name`,[month,year,ownerId]),
    query(`SELECT payment_method,COUNT(*) payments_count,COALESCE(SUM(amount_lbp),0) collected_lbp,COALESCE(SUM(amount_usd),0) collected_usd
      FROM payments WHERE owner_id=? AND status='completed' AND MONTH(paid_at)=? AND YEAR(paid_at)=?
      GROUP BY payment_method ORDER BY collected_lbp DESC,payment_method`,[ownerId,month,year]),
    query(`SELECT bc.id,u.full_name,u.is_active,
      COALESCE(pay.payments_count,0) payments_count,COALESCE(pay.collected_lbp,0) collected_lbp,
      COALESCE(st.transferred_lbp,0) transferred_lbp,COALESCE(bal.current_balance_lbp,0) current_balance_lbp,
      COALESCE(pend.pending_settlement_lbp,0) pending_settlement_lbp
      FROM bill_collectors bc JOIN users u ON u.id=bc.user_id
      LEFT JOIN (SELECT collector_id,COUNT(*) payments_count,COALESCE(SUM(amount_lbp),0) collected_lbp
        FROM payments WHERE owner_id=? AND collector_id IS NOT NULL AND status='completed' AND MONTH(paid_at)=? AND YEAR(paid_at)=? GROUP BY collector_id) pay ON pay.collector_id=bc.id
      LEFT JOIN (SELECT collector_id,COALESCE(SUM(amount_lbp),0) transferred_lbp
        FROM collector_settlements WHERE owner_id=? AND status='confirmed' AND MONTH(confirmed_at)=? AND YEAR(confirmed_at)=? GROUP BY collector_id) st ON st.collector_id=bc.id
      LEFT JOIN (SELECT collector_id,COALESCE(SUM(CASE WHEN tx_type IN ('bill_collection','adjustment') THEN amount_lbp ELSE -amount_lbp END),0) current_balance_lbp
        FROM collector_ledger WHERE owner_id=? GROUP BY collector_id) bal ON bal.collector_id=bc.id
      LEFT JOIN (SELECT collector_id,COALESCE(SUM(amount_lbp),0) pending_settlement_lbp
        FROM collector_settlements WHERE owner_id=? AND status='pending' GROUP BY collector_id) pend ON pend.collector_id=bc.id
      WHERE bc.owner_id=? ORDER BY collected_lbp DESC,u.full_name`,[ownerId,month,year,ownerId,month,year,ownerId,ownerId,ownerId]),
    query(`SELECT b.id,b.invoice_number,b.month,b.year,b.remaining_balance_lbp,b.remaining_balance_usd,b.status,
      sp.full_name subscriber_name,sp.phone,sp.meter_number,g.name generator_name
      FROM bills b JOIN subscriptions s ON s.id=b.subscription_id JOIN subscriber_profiles sp ON sp.id=s.subscriber_id
      JOIN plans p ON p.id=s.plan_id JOIN generators g ON g.id=p.generator_id
      WHERE s.owner_id=? AND b.month=? AND b.year=? AND b.status IN ('unpaid','partially_paid')
      ORDER BY b.remaining_balance_lbp DESC,b.id DESC LIMIT 10`,[ownerId,month,year])
  ]);
  return {billing,payments,generators,payment_methods:paymentMethods,collectors,outstanding_accounts:outstandingAccounts};
}
module.exports={isReadingBilled,deleteBill,combineBills,listBillsByIdsForOwner,listByOwner,getBillForOwner,getBill,previousBill,getForPeriod,createBill,recordPaymentAndUpdateBill,listPaymentsByOwner,listBillsBySubscriberUser,getBillBySubscriberUser,listPaymentsBySubscriberUser,listBillsForCollector,listRecentOwnerStats,ownerReportPeriod};
