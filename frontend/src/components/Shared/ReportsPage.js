import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { FiBarChart2, FiDownload, FiPrinter, FiRefreshCw } from 'react-icons/fi';

const now=new Date();
const money=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
const label=s=>String(s||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());

function MetricCard({title,value,sub}){
  return <div className="col-6 col-xl-3"><div className="stat-card h-100"><div className="stat-value" style={{fontSize:'1.15rem'}}>{value}</div><div className="stat-label">{title}</div>{sub&&<div className="text-muted small mt-1">{sub}</div>}</div></div>;
}
function CountRows({rows,empty='No data.'}){
  return <div className="table-responsive"><table className="table table-sm mb-0"><tbody>{rows.map((r,i)=><tr key={`${r.label}-${i}`}><td>{r.label}</td><td className="text-end"><b>{r.value}</b></td></tr>)}{!rows.length&&<tr><td className="text-muted">{empty}</td></tr>}</tbody></table></div>;
}
function csvCell(value){const s=String(value??'');return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;}
function downloadCsv(filename,headers,rows){
  const content=[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\n');
  const blob=new Blob([`\uFEFF${content}`],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

export default function ReportsPage(){
  const {user}=useAuth();
  const [period,setPeriod]=useState({month:now.getMonth()+1,year:now.getFullYear()});
  const [data,setData]=useState(null);const [err,setErr]=useState('');const [loading,setLoading]=useState(true);
  const url=user?.role==='admin'?'/admin/reports/summary':'/owner/reports/summary';
  const load=useCallback(async()=>{setLoading(true);try{const r=await api.get(url,{params:period});setData(r.data);setErr('');}catch(e){setErr(e.response?.data?.error||'Failed to load report.');}finally{setLoading(false);}},[url,period]);
  useEffect(()=>{load();},[load]);

  const cards=useMemo(()=>{
    if(!data)return[];
    if(user?.role==='admin'){
      return [
        ['Active Owners',data.platform?.active_owners||0],['Active Generators',data.platform?.active_generators||0],
        ['Active Subscriptions',data.platform?.active_subscriptions||0],['Collectors',data.platform?.active_collectors||0],
        ['Bills Generated',data.billing?.bills_generated||0],['Consumption',`${money(data.billing?.consumption_kwh)} kWh`],
        ['Current Charges',`${money(data.billing?.current_charges_lbp)} LBP`],['Collected',`${money(data.payments?.collected_lbp)} LBP`],
        ['Outstanding',`${money(data.billing?.outstanding_lbp)} LBP`],['Open Support',data.platform?.open_support_tickets||0],
        ['Platform Fees Expected',`$${money(data.platform_fees?.expected_usd)}`],['Platform Fees Received',`$${money(data.platform_fees?.received_usd)}`]
      ];
    }
    return [
      ['Generators',data.summary?.generators||0],['Active Subscribers',data.summary?.active_subscribers||0],
      ['Collectors',data.summary?.active_collectors||0],['Bills Generated',data.billing?.bills_generated||0],
      ['Consumption',`${money(data.billing?.consumption_kwh)} kWh`],['Current Charges',`${money(data.billing?.current_charges_lbp)} LBP`],
      ['Collected',`${money(data.payments?.collected_lbp)} LBP`],['Outstanding',`${money(data.billing?.outstanding_lbp)} LBP`],
      ['Paid Bills',data.billing?.paid_bills||0],['Open Bills',data.billing?.open_bills||0],
      ['Metered Bills',data.billing?.metered_bills||0],['Fixed Bills',data.billing?.fixed_bills||0]
    ];
  },[data,user]);

  const rows=user?.role==='admin'?(data?.owners||[]):(data?.generators||[]);
  const billingStatus=useMemo(()=>data?[['Paid',data.billing?.paid_bills],['Unpaid',data.billing?.unpaid_bills],['Partially Paid',data.billing?.partially_paid_bills],['Waived',data.billing?.waived_bills],['Carried Forward',data.billing?.carried_forward_bills]].map(([l,v])=>({label:l,value:Number(v||0)})):[],[data]);
  const paymentMethods=useMemo(()=>(data?.payment_methods||[]).map(r=>({label:label(r.payment_method),value:`${r.payments_count} / ${money(r.collected_lbp)} LBP`})),[data]);

  const exportReport=()=>{
    if(!data)return;
    if(user?.role==='admin'){
      downloadCsv(`powershare-admin-report-${period.year}-${String(period.month).padStart(2,'0')}.csv`,
        ['Owner','Active Generators','Active Subscribers','Collectors','Bills','Current Charges LBP','Outstanding LBP'],
        rows.map(r=>[r.owner_name,r.active_generators,r.active_subscribers,r.active_collectors,r.bills_generated,r.current_charges_lbp,r.outstanding_lbp]));
    }else{
      downloadCsv(`powershare-owner-report-${period.year}-${String(period.month).padStart(2,'0')}.csv`,
        ['Generator','Location','Active Subscribers','Bills','Consumption kWh','Current Charges LBP','Outstanding LBP'],
        rows.map(r=>[r.name,r.location_name,r.active_subscribers,r.bills_generated,r.consumption_kwh,r.current_charges_lbp,r.outstanding_lbp]));
    }
  };

  return <div>
    <div className="page-header"><div><h4 className="page-title"><FiBarChart2/> Reports & Analytics</h4><div className="text-muted">Operational and financial results for the selected billing period</div></div><div className="d-flex gap-2"><button className="btn btn-outline-primary" onClick={exportReport} disabled={!data}><FiDownload/> Export CSV</button><button className="btn btn-outline-primary" onClick={()=>window.print()}><FiPrinter/> Print</button></div></div>
    <div className="table-card p-3 mb-3"><div className="row g-2 align-items-end"><div className="col-sm-4 col-lg-2"><label className="form-label">Month</label><select className="form-select" value={period.month} onChange={e=>setPeriod({...period,month:Number(e.target.value)})}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{new Date(2026,i,1).toLocaleString(undefined,{month:'long'})}</option>)}</select></div><div className="col-sm-4 col-lg-2"><label className="form-label">Year</label><input type="number" min="2020" max="2200" className="form-control" value={period.year} onChange={e=>setPeriod({...period,year:Number(e.target.value)})}/></div><div className="col-sm-4 col-lg-2"><button className="btn btn-primary w-100" onClick={load} disabled={loading}><FiRefreshCw/> Refresh</button></div></div></div>
    {err&&<div className="alert alert-danger">{err}</div>}
    {loading?<div className="spinner-border"/>:data&&<>
      <div className="row g-3 mb-4">{cards.map(([k,v])=><MetricCard key={k} title={k} value={v}/>)}</div>
      <div className="table-card mb-3"><div className="p-3"><h6 className="mb-0">{user?.role==='admin'?'Generator Owner Performance':'Generator Performance'}</h6></div><div className="table-responsive"><table className="table table-hover mb-0"><thead><tr>{user?.role==='admin'?<><th>Owner</th><th>Generators</th><th>Active Subscribers</th><th>Collectors</th><th>Bills</th><th>Current Charges</th><th>Outstanding</th></>:<><th>Generator</th><th>Location</th><th>Subscribers</th><th>Bills</th><th>Consumption</th><th>Current Charges</th><th>Outstanding</th></>}</tr></thead><tbody>{rows.map(r=>user?.role==='admin'?<tr key={r.owner_id}><td><b>{r.owner_name}</b></td><td>{r.active_generators}</td><td>{r.active_subscribers}</td><td>{r.active_collectors}</td><td>{r.bills_generated}</td><td>{money(r.current_charges_lbp)} LBP</td><td>{money(r.outstanding_lbp)} LBP</td></tr>:<tr key={r.id}><td><b>{r.name}</b></td><td>{r.location_name}</td><td>{r.active_subscribers}</td><td>{r.bills_generated}</td><td>{money(r.consumption_kwh)} kWh</td><td>{money(r.current_charges_lbp)} LBP</td><td>{money(r.outstanding_lbp)} LBP</td></tr>)}{!rows.length&&<tr><td colSpan="7" className="text-center text-muted p-4">No data for this period.</td></tr>}</tbody></table></div></div>

      <div className="row g-3 mb-3">
        <div className="col-lg-6"><div className="table-card h-100"><div className="p-3 border-bottom"><b>Billing Status</b></div><CountRows rows={billingStatus}/></div></div>
        <div className="col-lg-6"><div className="table-card h-100"><div className="p-3 border-bottom"><b>Payment Methods</b><div className="text-muted small">Transactions / amount collected</div></div><CountRows rows={paymentMethods}/></div></div>
      </div>

      {user?.role==='admin'?<div className="row g-3 mb-3">
        <div className="col-lg-6"><div className="table-card h-100"><div className="p-3 border-bottom"><b>Platform Fee Collection</b></div><CountRows rows={[
          {label:'Owners Billed',value:data.platform_fees?.owners_billed||0},
          {label:'Expected',value:`$${money(data.platform_fees?.expected_usd)}`},
          {label:'Received',value:`$${money(data.platform_fees?.received_usd)}`},
          {label:'Pending',value:`$${money(data.platform_fees?.pending_usd)}`}
        ]}/></div></div>
        <div className="col-lg-6"><div className="table-card h-100"><div className="p-3 border-bottom"><b>Support Ticket Status</b></div><CountRows rows={(data.support_status||[]).map(r=>({label:label(r.status),value:r.ticket_count}))}/></div></div>
      </div>:<>
        <div className="table-card mb-3"><div className="p-3"><h6 className="mb-0">Collector Performance</h6><div className="text-muted small">Period collections and transfers, plus current cash balance</div></div><div className="table-responsive"><table className="table table-hover mb-0"><thead><tr><th>Collector</th><th>Status</th><th>Payments</th><th>Collected</th><th>Transferred</th><th>Pending Settlement</th><th>Current Balance</th></tr></thead><tbody>{(data.collectors||[]).map(r=><tr key={r.id}><td><b>{r.full_name}</b></td><td>{r.is_active?'Active':'Inactive'}</td><td>{r.payments_count}</td><td>{money(r.collected_lbp)} LBP</td><td>{money(r.transferred_lbp)} LBP</td><td>{money(r.pending_settlement_lbp)} LBP</td><td>{money(r.current_balance_lbp)} LBP</td></tr>)}{!(data.collectors||[]).length&&<tr><td colSpan="7" className="text-center text-muted p-4">No collectors.</td></tr>}</tbody></table></div></div>
        <div className="table-card mb-3"><div className="p-3"><h6 className="mb-0">Top Outstanding Accounts</h6><div className="text-muted small">Open invoices from the selected billing period</div></div><div className="table-responsive"><table className="table table-hover mb-0"><thead><tr><th>Subscriber</th><th>Meter</th><th>Generator</th><th>Invoice</th><th>Status</th><th>Outstanding</th></tr></thead><tbody>{(data.outstanding_accounts||[]).map(r=><tr key={r.id}><td><b>{r.subscriber_name}</b><div className="small text-muted">{r.phone||''}</div></td><td>{r.meter_number}</td><td>{r.generator_name}</td><td>{r.invoice_number}</td><td>{label(r.status)}</td><td>{money(r.remaining_balance_lbp)} LBP<div className="small text-muted">${money(r.remaining_balance_usd)}</div></td></tr>)}{!(data.outstanding_accounts||[]).length&&<tr><td colSpan="6" className="text-center text-muted p-4">No outstanding bills for this period.</td></tr>}</tbody></table></div></div>
      </>}
      <div className="text-muted small mt-3">Report period: {period.month}/{period.year}. Current charges exclude rolled-forward historical debt; outstanding includes only currently payable bills.</div>
    </>}
  </div>;
}
