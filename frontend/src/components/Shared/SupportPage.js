import UiText from "../Shared/UiText";
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Modal } from 'react-bootstrap';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LangContext';
import { FiMessageSquare, FiPlus, FiSend } from 'react-icons/fi';
const EMPTY = {
  subject: '',
  category: 'technical',
  description: '',
  priority: 'medium'
};
export default function SupportPage() {
  const {
    user
  } = useAuth();
  const {
    t: labels
  } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [reply, setReply] = useState('');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const {
        data
      } = await api.get('/support/tickets');
      setTickets(data || []);
    } catch (e) {
      setMsg({
        type: 'danger',
        text: e.response?.data?.error || 'Failed to load support tickets.'
      });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const openTicket = useCallback(async id => {
    try {
      const {
        data
      } = await api.get(`/support/tickets/${id}`);
      setSelected(data);
    } catch (e) {
      setMsg({
        type: 'danger',
        text: e.response?.data?.error || 'Unable to open ticket.'
      });
    }
  }, []);
  useEffect(() => {
    const ticketId = searchParams.get('ticket');
    if (ticketId && !loading) {
      openTicket(ticketId);
      setSearchParams({}, {
        replace: true
      });
    }
  }, [searchParams, setSearchParams, loading, openTicket]);
  const create = async e => {
    e.preventDefault();
    try {
      await api.post('/support/tickets', form);
      setForm(EMPTY);
      setShowCreate(false);
      setMsg({
        type: 'success',
        text: 'Support ticket created.'
      });
      load();
    } catch (e) {
      setMsg({
        type: 'danger',
        text: e.response?.data?.error || 'Failed to create ticket.'
      });
    }
  };
  const sendReply = async e => {
    e.preventDefault();
    if (!selected || !reply.trim()) return;
    try {
      await api.post(`/support/tickets/${selected.id}/replies`, {
        message: reply.trim()
      });
      setReply('');
      await openTicket(selected.id);
      await load();
    } catch (e) {
      setMsg({
        type: 'danger',
        text: e.response?.data?.error || 'Failed to send reply.'
      });
    }
  };
  const changeStatus = async status => {
    try {
      await api.put(`/support/tickets/${selected.id}/status`, {
        status
      });
      await openTicket(selected.id);
      await load();
    } catch (e) {
      setMsg({
        type: 'danger',
        text: e.response?.data?.error || 'Failed to update ticket.'
      });
    }
  };
  return <div>
    <div className="page-header"><h4 className="page-title"><FiMessageSquare /><UiText> Support Tickets</UiText></h4><button className="btn btn-primary" onClick={() => setShowCreate(true)}><FiPlus /><UiText> New Ticket</UiText></button></div>
    {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
    {loading ? <div className="spinner-border" /> : <div className="table-card"><div className="table-responsive"><table className="table table-hover mb-0"><thead><tr><th>#</th><th><UiText>Subject</UiText></th><th><UiText>Category</UiText></th><th><UiText>Priority</UiText></th><th><UiText>Status</UiText></th><th><UiText>Created By</UiText></th><th><UiText>Updated</UiText></th></tr></thead><tbody>
      {tickets.map(t => <tr key={t.id} onClick={() => openTicket(t.id)} style={{
              cursor: 'pointer'
            }}><td>{t.id}</td><td><button type="button" className="btn btn-link p-0 text-start fw-bold" aria-label={`${labels.openTicket}: ${t.subject}`}>{t.subject}</button></td><td><UiText>{t.category}</UiText></td><td><UiText>{t.priority}</UiText></td><td><span className={`badge-${t.status}`}><UiText>{t.status}</UiText></span></td><td>{t.created_by_name}</td><td>{new Date(t.updated_at).toLocaleString()}</td></tr>)}
      {!tickets.length && <tr><td colSpan="7" className="text-center text-muted p-4"><UiText>No support tickets.</UiText></td></tr>}
    </tbody></table></div></div>}

    <Modal show={showCreate} onHide={() => setShowCreate(false)} centered><form onSubmit={create}><Modal.Header closeButton><Modal.Title><UiText>New Support Ticket</UiText></Modal.Title></Modal.Header><Modal.Body>
      <div className="mb-3"><label className="form-label"><UiText>Subject</UiText></label><input className="form-control" value={form.subject} onChange={e => setForm({
              ...form,
              subject: e.target.value
            })} required /></div>
      <div className="row g-2 mb-3"><div className="col-7"><label className="form-label"><UiText>Category</UiText></label><select className="form-select" value={form.category} onChange={e => setForm({
                ...form,
                category: e.target.value
              })}>{['billing', 'meter', 'payment', 'outage', 'account', 'technical', 'other'].map(x => <option key={x} value={x}><UiText>{x}</UiText></option>)}</select></div><div className="col-5"><label className="form-label"><UiText>Priority</UiText></label><select className="form-select" value={form.priority} onChange={e => setForm({
                ...form,
                priority: e.target.value
              })}>{['low', 'medium', 'high'].map(x => <option key={x} value={x}><UiText>{x}</UiText></option>)}</select></div></div>
      <label className="form-label"><UiText>Description</UiText></label><textarea className="form-control" rows="5" value={form.description} onChange={e => setForm({
            ...form,
            description: e.target.value
          })} required />
    </Modal.Body><Modal.Footer><button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}><UiText>Cancel</UiText></button><button className="btn btn-primary"><UiText>Create Ticket</UiText></button></Modal.Footer></form></Modal>

    <Modal show={!!selected} onHide={() => setSelected(null)} size="lg" centered><Modal.Header closeButton><Modal.Title><UiText>Ticket #</UiText>{selected?.id}: {selected?.subject}</Modal.Title></Modal.Header><Modal.Body>
      {selected && <><div className="d-flex justify-content-between flex-wrap gap-2 mb-3"><div><span className={`badge-${selected.status}`}>{selected.status}</span> &nbsp; {selected.category} / {selected.priority}</div>{['admin', 'owner'].includes(user?.role) && <select className="form-select form-select-sm" style={{
              width: 160
            }} value={selected.status} onChange={e => changeStatus(e.target.value)}>{['open', 'in_progress', 'resolved', 'closed'].map(x => <option key={x} value={x}><UiText>{x}</UiText></option>)}</select>}</div>
      <div className="table-card p-3 mb-3"><b>{selected.created_by_name}</b><div className="text-muted small">{new Date(selected.created_at).toLocaleString()}</div><div className="mt-2">{selected.description}</div></div>
      {(selected.replies || []).map(r => <div className="table-card p-3 mb-2" key={r.id}><div><b>{r.responder_name}</b> <small className="text-muted">({r.responder_role})</small></div><small className="text-muted">{new Date(r.created_at).toLocaleString()}</small><div className="mt-2">{r.message}</div></div>)}
      {selected.status === 'closed' && user?.role !== 'admin' ? <div className="alert alert-secondary mt-3 mb-0"><UiText>This ticket is closed. Contact support or wait for an administrator to reopen it.</UiText></div> : <form onSubmit={sendReply} className="mt-3"><label className="form-label" htmlFor="support-reply"><UiText>Reply</UiText></label><div className="d-flex gap-2"><textarea id="support-reply" className="form-control" rows="2" value={reply} onChange={e => setReply(e.target.value)} required /><button className="btn btn-primary" aria-label={labels.sendReply}><FiSend /></button></div></form>}</>}
    </Modal.Body></Modal>
  </div>;
}
