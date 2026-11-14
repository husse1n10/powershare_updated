import React,{useEffect,useState} from 'react';
import api from '../../services/api';
import {useLang} from '../../contexts/LangContext';
export default function SubscriberOutages(){
  const {t}=useLang();const [rows,setRows]=useState([]);const [loading,setLoading]=useState(true);const [err,setErr]=useState('');
  useEffect(()=>{api.get('/subscriber/outages').then(r=>setRows(r.data||[])).catch(e=>setErr(e.response?.data?.error||t.failed)).finally(()=>setLoading(false));},[t.failed]);
  return <div><div className="page-header"><h4 className="page-title">{t.outageSchedule}</h4></div>{err&&<div className="alert alert-danger">{err}</div>}{loading?<div className="text-muted">{t.loading}</div>:<div className="row g-3">{rows.map(o=><div className="col-md-6 col-xl-4" key={o.id}><div className="table-card p-3 h-100"><h6>{o.generator_name}</h6><div><b>{o.schedule_type==='recurring'?`${t.weeklyDay} ${o.day_of_week}`:o.outage_date}</b></div><div>{o.start_time} - {o.end_time}</div><div className="text-muted mt-2">{o.notes||t.scheduledOutage}</div></div></div>)}{!rows.length&&<div className="text-muted">{t.noOutages}</div>}</div>}</div>;
}
