import React,{useEffect,useState} from 'react';
import api from '../../services/api';
import {useLang} from '../../contexts/LangContext';
export default function SubscriberConsumption(){
  const {t}=useLang();const [rows,setRows]=useState([]);const [loading,setLoading]=useState(true);const [err,setErr]=useState('');
  useEffect(()=>{api.get('/subscriber/consumption').then(r=>setRows(r.data||[])).catch(e=>setErr(e.response?.data?.error||t.failed)).finally(()=>setLoading(false));},[t.failed]);
  return <div><div className="page-header"><h4 className="page-title">{t.consumptionHistory}</h4></div>{err&&<div className="alert alert-danger">{err}</div>}<div className="table-card"><div className="table-responsive"><table className="table mb-0"><thead><tr><th>{t.date}</th><th>{t.previous}</th><th>{t.current}</th><th>{t.consumption}</th><th>{t.invoice}</th></tr></thead><tbody>{loading&&<tr><td colSpan="5" className="text-center text-muted p-4">{t.loading}</td></tr>}{!loading&&rows.map(r=><tr key={r.id}><td>{r.reading_date}</td><td>{r.previous_value}</td><td>{r.reading_value}</td><td><b>{Number(r.kwh_diff||0).toFixed(2)} kWh</b></td><td>{r.invoice_number||'—'}</td></tr>)}{!loading&&!rows.length&&<tr><td colSpan="5" className="text-center text-muted p-4">{t.noData}</td></tr>}</tbody></table></div></div></div>;
}
