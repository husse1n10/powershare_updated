'use strict';

require('dotenv').config();
const { pool, query, queryOne } = require('../DAL/database/connection');

const REQUIRED_TABLES = [
  'registration_applications','users','generator_owners','bill_collectors','subscriber_profiles','generators',
  'owner_main_meters','plans','plan_monthly_pricing','subscriptions','meter_readings',
  'bills','payments','collector_ledger','collector_settlements','outage_schedules',
  'notifications','support_tickets','support_ticket_responses','audit_logs','refresh_tokens',
  'platform_settings','platform_fee_collections','collector_generator_assignments','collector_subscriber_assignments'
];

async function main(){
  const failures=[];
  const info=[];
  try{
    const version=await queryOne('SELECT VERSION() version');
    info.push(`MySQL connected: ${version?.version||'unknown version'}`);

    const tables=await query('SHOW TABLES');
    const tableNames=new Set(tables.map(r=>String(Object.values(r)[0])));
    for(const table of REQUIRED_TABLES) if(!tableNames.has(table)) failures.push(`Missing required table: ${table}`);

    const orphanOwners=await queryOne(`SELECT COUNT(*) count FROM generator_owners go LEFT JOIN users u ON u.id=go.user_id WHERE u.id IS NULL OR u.role<>'owner'`);
    if(Number(orphanOwners?.count||0)>0)failures.push(`Owner profile integrity: ${orphanOwners.count} invalid/orphan record(s)`);

    const orphanCollectors=await queryOne(`SELECT COUNT(*) count FROM bill_collectors bc LEFT JOIN users u ON u.id=bc.user_id LEFT JOIN generator_owners go ON go.id=bc.owner_id WHERE u.id IS NULL OR u.role<>'collector' OR go.id IS NULL`);
    if(Number(orphanCollectors?.count||0)>0)failures.push(`Collector profile integrity: ${orphanCollectors.count} invalid/orphan record(s)`);

    const badBills=await queryOne(`SELECT COUNT(*) count FROM bills WHERE usd_lbp_rate<=0 OR amount_due_lbp<0 OR amount_due_usd<0 OR remaining_balance_lbp<0 OR remaining_balance_usd<0`);
    if(Number(badBills?.count||0)>0)failures.push(`Financial integrity: ${badBills.count} bill(s) contain invalid amounts/rates`);

    const badPayments=await queryOne(`SELECT COUNT(*) count FROM payments WHERE amount_lbp<0 OR amount_usd<0 OR usd_lbp_rate<=0`);
    if(Number(badPayments?.count||0)>0)failures.push(`Payment integrity: ${badPayments.count} invalid payment(s)`);

    const mismatchedPaymentTotals=await queryOne(`SELECT COUNT(*) count FROM (
      SELECT b.id FROM bills b LEFT JOIN payments p ON p.bill_id=b.id AND p.status='completed'
      GROUP BY b.id,b.amount_received_lbp HAVING ABS(COALESCE(SUM(p.amount_lbp),0)-b.amount_received_lbp)>0.01
    ) x`);
    if(Number(mismatchedPaymentTotals?.count||0)>0)failures.push(`Payment integrity: ${mismatchedPaymentTotals.count} bill(s) do not match completed payment totals`);

    const badPaidBills=await queryOne(`SELECT COUNT(*) count FROM bills WHERE status='paid' AND (remaining_balance_lbp>0.01 OR remaining_balance_usd>0.01)`);
    if(Number(badPaidBills?.count||0)>0)failures.push(`Financial integrity: ${badPaidBills.count} paid bill(s) still have remaining balance`);

    const badCarryState=await queryOne(`SELECT COUNT(*) count FROM bills WHERE (status='carried_forward' AND carried_forward_to_bill_id IS NULL) OR (status IN ('unpaid','partially_paid','paid') AND carried_forward_to_bill_id IS NOT NULL)`);
    if(Number(badCarryState?.count||0)>0)failures.push(`Carry-forward integrity: ${badCarryState.count} bill(s) have inconsistent carry-forward state`);

    const badCarryLinks=await queryOne(`SELECT COUNT(*) count FROM bills source JOIN bills target ON target.id=source.carried_forward_to_bill_id WHERE source.subscription_id<>target.subscription_id`);
    if(Number(badCarryLinks?.count||0)>0)failures.push(`Carry-forward integrity: ${badCarryLinks.count} carry-forward link(s) cross subscriptions`);

    const missingCarrySources=await queryOne(`SELECT COUNT(*) count FROM bills target WHERE (target.previous_balance_lbp>0.01 OR target.previous_balance_usd>0.01) AND NOT EXISTS (SELECT 1 FROM bills source WHERE source.carried_forward_to_bill_id=target.id AND source.subscription_id=target.subscription_id)`);
    if(Number(missingCarrySources?.count||0)>0)failures.push(`Carry-forward integrity: ${missingCarrySources.count} bill(s) contain previous balance without source lineage`);

    const missingCollectorLedger=await queryOne(`SELECT COUNT(*) count FROM payments p WHERE p.collector_id IS NOT NULL AND p.status='completed' AND NOT EXISTS (SELECT 1 FROM collector_ledger cl WHERE cl.payment_id=p.id AND cl.collector_id=p.collector_id AND cl.tx_type='bill_collection')`);
    if(Number(missingCollectorLedger?.count||0)>0)failures.push(`Collector ledger integrity: ${missingCollectorLedger.count} collector payment(s) have no ledger entry`);

    const missingSettlementLedger=await queryOne(`SELECT COUNT(*) count FROM collector_settlements cs WHERE cs.status='confirmed' AND NOT EXISTS (SELECT 1 FROM collector_ledger cl WHERE cl.settlement_id=cs.id AND cl.tx_type='owner_settlement')`);
    if(Number(missingSettlementLedger?.count||0)>0)failures.push(`Collector settlement integrity: ${missingSettlementLedger.count} confirmed settlement(s) have no ledger entry`);

    const danglingCarry=await queryOne(`SELECT COUNT(*) count FROM bills src LEFT JOIN bills tgt ON tgt.id=src.carried_forward_to_bill_id WHERE src.carried_forward_to_bill_id IS NOT NULL AND tgt.id IS NULL`);
    if(Number(danglingCarry?.count||0)>0)failures.push(`Carry-forward integrity: ${danglingCarry.count} bill(s) point to a deleted carry-forward target`);

    const danglingCombined=await queryOne(`SELECT COUNT(*) count FROM bills m LEFT JOIN bills p ON p.id=m.combined_parent_bill_id WHERE m.combined_parent_bill_id IS NOT NULL AND p.id IS NULL`);
    if(Number(danglingCombined?.count||0)>0)failures.push(`Combined invoice integrity: ${danglingCombined.count} merged bill(s) point to a missing combined invoice`);

    const openBalanceMismatch=await queryOne(`SELECT COUNT(*) count FROM bills WHERE status IN ('unpaid','partially_paid') AND ABS((amount_due_lbp-amount_received_lbp)-remaining_balance_lbp)>0.01`);
    if(Number(openBalanceMismatch?.count||0)>0)failures.push(`Financial integrity: ${openBalanceMismatch.count} open bill(s) where remaining balance != amount due - amount received`);

    const readingBilledTwice=await query(`SELECT meter_reading_id FROM bills WHERE meter_reading_id IS NOT NULL GROUP BY meter_reading_id HAVING COUNT(*)>1`);
    if(readingBilledTwice.length)failures.push(`Meter integrity: ${readingBilledTwice.length} meter reading(s) billed on more than one invoice`);

    const reversedReadings=await queryOne(`SELECT COUNT(*) count FROM meter_readings WHERE reading_value<previous_value`);
    if(Number(reversedReadings?.count||0)>0)failures.push(`Meter integrity: ${reversedReadings.count} reading(s) lower than previous reading`);

    const duplicateMeters=await query(`SELECT created_by_owner,meter_number,COUNT(*) count FROM subscriber_profiles WHERE meter_number IS NOT NULL AND meter_number<>'' AND account_status='active' GROUP BY created_by_owner,meter_number HAVING COUNT(*)>1`);
    if(duplicateMeters.length)failures.push(`Subscriber integrity: ${duplicateMeters.length} duplicate active meter number(s) within an owner`);

    const settings=await queryOne(`SELECT COUNT(*) count FROM platform_settings WHERE setting_key IN ('platform_fee_per_subscriber','default_usd_lbp_rate','simulated_online_payment_enabled')`);
    if(Number(settings?.count||0)<3)failures.push('Required platform settings are missing');

    info.push(`Required tables present: ${REQUIRED_TABLES.length-failures.filter(x=>x.startsWith('Missing required table')).length}/${REQUIRED_TABLES.length}`);
  } finally {
    await pool.end();
  }

  for(const line of info)console.log(line);
  if(failures.length){
    console.error('Database smoke test FAILED:');
    failures.forEach(x=>console.error(` - ${x}`));
    process.exit(1);
  }
  console.log('Database smoke test passed: schema and core integrity checks are healthy.');
}

main().catch(err=>{
  console.error(`Database smoke test could not complete: ${err.message}`);
  process.exit(1);
});
