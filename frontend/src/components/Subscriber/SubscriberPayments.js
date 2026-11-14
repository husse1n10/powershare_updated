import React,{useEffect,useState} from 'react';
import api from '../../services/api';
import {useLang} from '../../contexts/LangContext';
export default function SubscriberPayments(){
  const {t}=useLang();const [rows,setRows]=useState([]);const [loading,setLoading]=useState(true);const [err,setErr]=useState('');
  useEffect(()=>{api.get('/subscriber/payments').then(r=>setRows(r.data||[])).catch(e=>setErr(e.response?.data?.error||t.failed)).finally(()=>setLoading(false));},[t.failed]);
  return <div><div className="page-header"><h4 className="page-title">{t.paymentHistory}</h4></div>{err&&<div className="alert alert-danger">{err}</div>}<div className="table-card"><div className="table-responsive"><table className="table mb-0"><thead><tr><th>{t.date}</th><th>{t.invoice}</th><th>USD</th><th>LBP</th><th>{t.method}</th><th>{t.status}</th></tr></thead><tbody>{loading&&<tr><td colSpan="6" className="text-center text-muted p-4">{t.loading}</td></tr>}{!loading&&rows.map(r=><tr key={r.id}><td>{new Date(r.paid_at).toLocaleString()}</td><td>{r.invoice_number}</td><td>${Number(r.amount_usd||0).toFixed(2)}</td><td>{Number(r.amount_lbp||0).toLocaleString()}</td><td>{r.payment_method}</td><td>{r.status}</td></tr>)}{!loading&&!rows.length&&<tr><td colSpan="6" className="text-center text-muted p-4">{t.noData}</td></tr>}</tbody></table></div></div></div>;
}
