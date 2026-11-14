import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from 'react-bootstrap';
import api from '../../services/api';
import { useLang } from '../../contexts/LangContext';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';
import { FiZap, FiEdit2, FiTrash2, FiPlus, FiUsers, FiActivity } from 'react-icons/fi';
import AppSelect from '../Shared/AppSelect';

export default function OwnerGenerators() {
  const { t } = useLang();
  const confirm = useConfirmDialog();
  const [generators, setGenerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name:'', location_name:'', main_meter_number:'', total_kw:'', is_active:1 });
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try { const res = await api.get('/owner/generators'); setGenerators(res.data||[]); }
    catch (_) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ name:'', location_name:'', main_meter_number:'', total_kw:'', is_active:1 }); setShowModal(true); };
  const openEdit = (g) => { setEditing(g.id); setForm({ name:g.name||'', location_name:g.location_name||'', main_meter_number:g.main_meter_number||'', total_kw:g.total_kw??'', is_active:g.is_active?1:0 }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, total_kw: form.total_kw===''?0:Number(form.total_kw), is_active: Number(form.is_active||0) };
      if (editing) await api.put(`/owner/generators/${editing}`, payload);
      else await api.post('/owner/generators', payload);
      setShowModal(false);
      setMsg({ type:'success', text: editing ? 'Generator updated' : 'Generator created' });
      load();
    } catch (err) { setMsg({ type:'danger', text: err.response?.data?.error||'Failed' }); }
  };

  const handleDelete = async (id) => {
    const approved = await confirm({
      title: 'Delete Generator',
      message: 'Delete this generator?',
      confirmText: t.delete || 'Delete',
      intent: 'danger',
    });
    if (!approved) return;
    try { await api.delete(`/owner/generators/${id}`); setMsg({ type:'success', text:'Deleted' }); load(); }
    catch (err) { setMsg({ type:'danger', text: err.response?.data?.error||'Failed' }); }
  };

  return (
    <div>
      <div className="page-header">
        <h4 className="page-title">{t.generators}</h4>
        <button className="btn btn-primary" onClick={openCreate}><FiPlus /> {t.addGenerator}</button>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type} alert-dismissible mb-3`}>
          {msg.text}<button className="btn-close" onClick={() => setMsg(null)}>✕</button>
        </div>
      )}

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}><div className="spinner-border" /></div>
      ) : generators.length === 0 ? (
        <div style={{ textAlign:'center', color:'var(--text-muted)', padding:'60px 20px', fontSize:'0.9rem' }}>{t.noGenerators}</div>
      ) : (
        <div className="row g-3">
          {generators.map(g => (
            <div className="col-12 col-sm-6 col-xl-4" key={g.id}>
              <div className="table-card h-100" style={{ padding:'16px' }}>
                {/* Header */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12, gap:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                    <div style={{ width:34, height:34, borderRadius:'var(--radius-sm)', background:'var(--accent-light)', color:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', flexShrink:0 }}>
                      <FiZap />
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:'0.93rem', color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{g.name}</div>
                      <div style={{ fontSize:'0.76rem', color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{g.location_name}</div>
                    </div>
                  </div>
                  <span className={g.is_active ? 'badge-active' : 'badge-inactive'} style={{ flexShrink:0 }}>
                    {g.is_active ? t.active : t.inactive}
                  </span>
                </div>

                {g.main_meter_number && (
                  <div style={{ fontSize:'0.78rem', color:'var(--text-sub)', marginBottom:10 }}>
                    Meter: <code>{g.main_meter_number}</code>
                  </div>
                )}
                {/* Mini stats — fluid 3-col grid */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:14 }}>
                  {[
                    { icon:<FiActivity />, val:g.plan_count||0,       label:t.plans },
                    { icon:<FiUsers />,   val:g.subscriber_count||0,  label:t.subscribers },
                    { icon:<FiZap />,     val:Number(g.total_kw||0).toLocaleString(), label:t.totalKW },
                  ].map(item => (
                    <div key={item.label} style={{ background:'var(--bg3)', borderRadius:'var(--radius-sm)', padding:'7px 4px', textAlign:'center' }}>
                      <div style={{ fontWeight:700, fontSize:'1rem', color:'var(--text)' }}>{item.val}</div>
                      <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', marginTop:1, textTransform:'uppercase', letterSpacing:'0.04em' }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display:'flex', gap:6 }}>
                  <button className="btn btn-sm btn-outline-primary" style={{ flex:1, justifyContent:'center' }} onClick={() => openEdit(g)}>
                    <FiEdit2 /> {t.edit}
                  </button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(g.id)} title={t.delete}>
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton><Modal.Title>{editing ? t.edit : t.addGenerator}</Modal.Title></Modal.Header>
        <Modal.Body>
          <form id="genForm" onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label">{t.name} *</label>
                <input className="form-control" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required autoFocus />
              </div>
              <div className="col-12">
                <label className="form-label">{t.locationName} *</label>
                <input className="form-control" value={form.location_name} onChange={e=>setForm(f=>({...f,location_name:e.target.value}))} required />
              </div>
              <div className="col-12">
                <label className="form-label">{t.meterNumber}</label>
                <input className="form-control" value={form.main_meter_number} onChange={e=>setForm(f=>({...f,main_meter_number:e.target.value}))} />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">{t.totalKW}</label>
                <input type="number" className="form-control" value={form.total_kw} onChange={e=>setForm(f=>({...f,total_kw:e.target.value}))} min={0} step={0.1} />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">{t.status}</label>
                <AppSelect className="form-select" value={form.is_active} onChange={e=>setForm(f=>({...f,is_active:Number(e.target.value)}))}>
                  <option value={1}>{t.active}</option>
                  <option value={0}>{t.inactive}</option>
                </AppSelect>
              </div>
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t.cancel}</button>
          <button type="submit" form="genForm" className="btn btn-primary">{editing ? t.save : t.create}</button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
