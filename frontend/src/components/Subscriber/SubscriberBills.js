import React,{useEffect,useState,useCallback} from 'react';
import {Modal} from 'react-bootstrap';
import {FiEye,FiCreditCard} from 'react-icons/fi';
import api from '../../services/api';
import {useLang} from '../../contexts/LangContext';
import InvoicePrint from '../Shared/InvoicePrint';

function statusClass(status){return `badge-${status==='partially_paid'?'unpaid':status}`;}

export default function SubscriberBills(){
  const {t}=useLang();
  const [bills,setBills]=useState([]);
  const [payBill,setPayBill]=useState(null);
  const [amount,setAmount]=useState('');
  const [msg,setMsg]=useState(null);
  const [loading,setLoading]=useState(true);
  const [invoice,setInvoice]=useState(null);
  const [invoiceLoading,setInvoiceLoading]=useState(false);

  const load=useCallback(async()=>{
    try{setLoading(true);const r=await api.get('/subscriber/bills');setBills(r.data||[]);}
    catch(err){setMsg({type:'danger',text:err.response?.data?.error||t.failed});}
    finally{setLoading(false);}
  },[t.failed]);

  useEffect(()=>{load();},[load]);

  const openInvoice=async billId=>{
    try{
      setInvoiceLoading(true);
      const r=await api.get(`/subscriber/bills/${billId}`);
      setInvoice({bill:r.data?.bill,owner:r.data?.owner});
    }catch(err){setMsg({type:'danger',text:err.response?.data?.error||t.failed});}
    finally{setInvoiceLoading(false);}
  };

  const pay=async e=>{
    e.preventDefault();
    try{
      await api.post(`/subscriber/bills/${payBill.id}/simulated-payment`,{amount_usd:Number(amount)});
      setMsg({type:'success',text:t.simulatedPaymentRecorded});
      setPayBill(null);
      await load();
    }catch(err){setMsg({type:'danger',text:err.response?.data?.error||t.failed});}
  };

  return <div>
    <div className="page-header"><h4 className="page-title">{t.billsInvoices}</h4></div>
    {msg&&<div className={`alert alert-${msg.type}`}>{msg.text}</div>}
    <div className="table-card">
      <div className="table-responsive"><table className="table mb-0">
        <thead><tr><th>{t.invoice}</th><th>{t.period}</th><th>{t.consumption}</th><th>{t.totalTTC}</th><th>{t.remaining}</th><th>{t.status}</th><th>{t.actions}</th></tr></thead>
        <tbody>
          {loading&&<tr><td colSpan="7" className="text-center text-muted p-4">{t.loading}</td></tr>}
          {!loading&&bills.map(b=><tr key={b.id}>
            <td><code>{b.invoice_number}</code></td>
            <td>{b.month}/{b.year}</td>
            <td>{Number(b.kwh_used||0).toFixed(2)} kWh</td>
            <td>${Number(b.amount_due_usd||0).toFixed(2)}</td>
            <td>${Number(b.remaining_balance_usd||0).toFixed(2)}</td>
            <td><span className={statusClass(b.status)}>{b.status}</span></td>
            <td><div className="d-flex gap-2 flex-wrap">
              <button className="btn btn-sm btn-outline-primary" onClick={()=>openInvoice(b.id)} disabled={invoiceLoading}><FiEye/> {t.viewInvoice}</button>
              {['unpaid','partially_paid'].includes(b.status)&&<button className="btn btn-sm btn-primary" onClick={()=>{setPayBill(b);setAmount(Number(b.remaining_balance_usd||0).toFixed(2));}}><FiCreditCard/> {t.simulatePayment}</button>}
            </div></td>
          </tr>)}
          {!loading&&!bills.length&&<tr><td colSpan="7" className="text-center text-muted p-4">{t.noBillsFound}</td></tr>}
        </tbody>
      </table></div>
    </div>

    <Modal show={!!payBill} onHide={()=>setPayBill(null)} centered>
      <form onSubmit={pay}>
        <Modal.Header closeButton><Modal.Title>{t.simulatePayment}</Modal.Title></Modal.Header>
        <Modal.Body>
          <div className="alert alert-warning">{t.demoPaymentWarning}</div>
          <label className="form-label">{t.amountUsd}</label>
          <input type="number" step="0.01" min="0.01" max={Number(payBill?.remaining_balance_usd||0)||undefined} className="form-control" value={amount} onChange={e=>setAmount(e.target.value)} required/>
        </Modal.Body>
        <Modal.Footer><button type="button" className="btn btn-secondary" onClick={()=>setPayBill(null)}>{t.cancel}</button><button className="btn btn-primary">{t.confirm}</button></Modal.Footer>
      </form>
    </Modal>

    <Modal show={!!invoice} onHide={()=>setInvoice(null)} size="xl" centered scrollable>
      <Modal.Header closeButton><Modal.Title>{t.viewInvoice}</Modal.Title></Modal.Header>
      <Modal.Body>{invoice?.bill&&invoice?.owner?<InvoicePrint bill={invoice.bill} owner={invoice.owner}/>:<div className="text-muted">{t.loading}</div>}</Modal.Body>
    </Modal>
  </div>;
}
