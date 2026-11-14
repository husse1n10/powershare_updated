import React,{useCallback,useEffect,useState} from 'react';
import PendingApplication from './PendingApplication';
import api from '../../services/api';
import {FiZap,FiFileText,FiDollarSign,FiAlertCircle} from 'react-icons/fi';
import {useLang} from '../../contexts/LangContext';
const money=n=>Number(n||0).toLocaleString();
export default function SubscriberDashboard(){
  const {t}=useLang();const [d,setD]=useState(null);const [err,setErr]=useState('');
  const load=useCallback(()=>{setErr('');setD(null);api.get('/subscriber/dashboard').then(r=>setD(r.data)).catch(e=>setErr(e.response?.data?.error||t.failed));},[t.failed]);
  useEffect(()=>{load();const changed=e=>{if(e.detail?.type==='system'&&e.detail?.action_url==='/subscriber')load();};window.addEventListener('powershare:notification-new',changed);return()=>window.removeEventListener('powershare:notification-new',changed);},[load]);
  if(err)return <div className="alert alert-danger">{err}</div>;if(!d)return <div className="spinner-border"/>;
  if(d.registration_application?.status==='pending')return <PendingApplication application={d.registration_application} onRefresh={load}/>;
  const s=d.subscription||{};const cards=[[t.generator,s.generator_name,<FiZap/>],[t.currentBill,d.current_bill?.invoice_number||'—',<FiFileText/>],[t.outstandingLbp,money(d.outstanding_lbp),<FiDollarSign/>],[t.upcomingOutages,d.upcoming_outages?.length||0,<FiAlertCircle/>]];
  return <div><div className="page-header"><h4 className="page-title">{t.subscriberDashboard}</h4></div><div className="row g-3 mb-4">{cards.map(([l,v,i])=><div className="col-6 col-lg-3" key={l}><div className="stat-card h-100"><div className="stat-icon">{i}</div><div className="stat-value" style={{fontSize:'1.05rem'}}>{v}</div><div className="stat-label">{l}</div></div></div>)}</div><div className="row g-3"><div className="col-lg-6"><div className="table-card p-3 h-100"><h6>{t.mySubscription}</h6><p><b>{t.plan}:</b> {s.plan_name} ({s.ampere}A)</p><p><b>{t.meterNumber}:</b> {s.meter_number||'—'}</p><p><b>{t.address}:</b> {s.location_address}</p><p><b>{t.owner}:</b> {s.owner_business_name||'—'}</p></div></div><div className="col-lg-6"><div className="table-card p-3 h-100"><h6>{t.recentConsumption}</h6>{(d.recent_consumption||[]).map(x=><div className="data-card-row" key={x.id}><span>{x.reading_date}</span><b>{Number(x.kwh_diff||0).toFixed(2)} kWh</b></div>)}{!d.recent_consumption?.length&&<div className="text-muted">{t.noReadingsYet}</div>}</div></div></div></div>;
}
