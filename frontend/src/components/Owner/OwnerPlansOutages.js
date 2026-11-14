import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal } from 'react-bootstrap';
import api from '../../services/api';
import { useLang } from '../../contexts/LangContext';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';

function normalizeOptionValue(value) {
  return String(value || '').trim().toLowerCase();
}

export function OwnerPlans() {
  const { t } = useLang();
  const confirm = useConfirmDialog();
  const [plans, setPlans] = useState([]);
  const [generators, setGenerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ generator_id:'', name:'', ampere:'', monthly_cost_lbp:'', maintenance_lbp:'' });
  const [generatorPickerValue, setGeneratorPickerValue] = useState('');
  const [msg, setMsg] = useState(null);

  const generatorOptions = useMemo(
    () => (generators || []).map((g) => ({
      id: String(g.id),
      label: String(g.name || ''),
    })),
    [generators]
  );

  const findGeneratorOption = useCallback(
    (value) => {
      const normalized = normalizeOptionValue(value);
      if (!normalized) return null;
      return generatorOptions.find((option) => (
        normalizeOptionValue(option.id) === normalized
        || normalizeOptionValue(option.label) === normalized
      )) || null;
    },
    [generatorOptions]
  );

  const load = useCallback(async () => {
    try {
      const [p, g] = await Promise.all([api.get('/owner/plans'), api.get('/owner/generators')]);
      setPlans(p.data); setGenerators(g.data);
    } catch (_) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (p) => {
    setEditing(p.id);
    setForm({ generator_id:p.generator_id, name:p.name, ampere:p.ampere, monthly_cost_lbp:p.monthly_cost_lbp, maintenance_lbp:p.maintenance_lbp });
    const matchedGenerator = generatorOptions.find((option) => option.id === String(p.generator_id || ''));
    setGeneratorPickerValue(matchedGenerator?.label || (p.generator_name ? String(p.generator_name) : ''));
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const selectedGenerator = findGeneratorOption(generatorPickerValue || form.generator_id);
    if (!selectedGenerator) {
      setMsg({ type:'danger', text:'Please select a valid generator from the list.' });
      return;
    }

    const payload = {
      ...form,
      generator_id: selectedGenerator.id,
    };

    try {
      if (editing) await api.put(`/owner/plans/${editing}`, payload);
      else await api.post('/owner/plans', payload);
      setShowModal(false); load();
    } catch (err) { setMsg({ type:'danger', text: err.response?.data?.error||'Failed' }); }
  };

  const handleDelete = async (id) => {
    const approved = await confirm({
      title: 'Delete Plan',
      message: 'Delete this plan?',
      confirmText: t.delete,
      intent: 'danger',
    });
    if (!approved) return;
    try { await api.delete(`/owner/plans/${id}`); load(); }
    catch (err) { setMsg({ type:'danger', text: err.response?.data?.error||'Failed' }); }
  };

  return (
    <div>
      <div className="page-header">
        <h4 className="page-title">{t.plans}</h4>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({generator_id:'',name:'',ampere:'',monthly_cost_lbp:'',maintenance_lbp:''}); setGeneratorPickerValue(''); setShowModal(true); }}>
          <FiPlus /> {t.addPlan}
        </button>
      </div>

      {msg && <div className={`alert alert-${msg.type} alert-dismissible mb-3`}>{msg.text}<button className="btn-close" aria-label="Close" onClick={() => setMsg(null)} /></div>}

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}><div className="spinner-border" /></div>
      ) : (
        <div className="table-card">
          {/* Mobile cards */}
          <div className="d-lg-none" style={{ padding:'8px 10px' }}>
            {plans.map(p => (
              <div className="data-card" key={p.id}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                  <div style={{ minWidth:0 }}>
                    <div className="data-card-title">{p.name} <span style={{ color:'var(--text-muted)', fontWeight:400, fontSize:'0.8rem' }}>({p.ampere}A)</span></div>
                    <div className="data-card-sub">{p.generator_name}</div>
                  </div>
                  <span className={p.is_active ? 'badge-active' : 'badge-inactive'}>{p.is_active ? t.active : t.inactive}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, margin:'8px 0' }}>
                  {[
                    [t.baseCostLBP,    Number(p.monthly_cost_lbp).toLocaleString()+' LBP'],
                    [t.maintenanceLBP, Number(p.maintenance_lbp||0).toLocaleString()+' LBP'],
                    [t.totalPerMonth,  Number((Number(p.monthly_cost_lbp||0)+Number(p.maintenance_lbp||0))).toLocaleString()+' LBP'],
                    [t.subscriberCount, p.subscriber_count||0],
                  ].map(([label,val]) => (
                    <div key={label} style={{ background:'var(--bg3)', borderRadius:'var(--radius-sm)', padding:'6px 8px' }}>
                      <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
                      <div style={{ fontWeight:600, fontSize:'0.82rem', color:'var(--text)' }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button className="btn btn-sm btn-outline-primary" onClick={() => openEdit(p)}><FiEdit2 /> {t.edit}</button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(p.id)}><FiTrash2 /></button>
                </div>
              </div>
            ))}
            {!plans.length && <div style={{ textAlign:'center', color:'var(--text-muted)', padding:'36px 0', fontSize:'0.88rem' }}>{t.noPlansFound}</div>}
          </div>

          {/* Desktop table */}
          <div className="d-none d-lg-block table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>{t.generator}</th><th>{t.name}</th><th>{t.ampere}</th>
                  <th>{t.baseCostLBP}</th><th>{t.maintenanceLBP}</th><th>{t.totalPerMonth}</th>
                  <th>{t.subscriberCount}</th><th>{t.status}</th><th>{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {plans.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontSize:'0.84rem' }}>{p.generator_name}</td>
                    <td style={{ fontWeight:600 }}>{p.name}</td>
                    <td>{p.ampere}A</td>
                    <td>{Number(p.monthly_cost_lbp).toLocaleString()} LBP</td>
                    <td>{Number(p.maintenance_lbp||0).toLocaleString()} LBP</td>
                    <td style={{ fontWeight:600 }}>{Number(Number(p.monthly_cost_lbp||0)+Number(p.maintenance_lbp||0)).toLocaleString()} LBP</td>
                    <td>{p.subscriber_count||0}</td>
                    <td><span className={p.is_active ? 'badge-active' : 'badge-inactive'}>{p.is_active ? t.active : t.inactive}</span></td>
                    <td>
                      <div style={{ display:'flex', gap:4 }}>
                        <button className="btn btn-sm btn-outline-primary" onClick={() => openEdit(p)}><FiEdit2 /></button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(p.id)}><FiTrash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!plans.length && <tr><td colSpan={9} style={{ textAlign:'center', color:'var(--text-muted)', padding:'32px', fontSize:'0.85rem' }}>{t.noPlansFound}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton><Modal.Title>{editing ? t.edit : t.addPlan}</Modal.Title></Modal.Header>
        <Modal.Body>
          <form id="planForm" onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label">{t.generator} *</label>
                <input
                  className="form-control"
                  list="plan-generator-options"
                  value={generatorPickerValue}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setGeneratorPickerValue(nextValue);
                    const matched = findGeneratorOption(nextValue);
                    setForm((f) => ({ ...f, generator_id: matched ? matched.id : '' }));
                  }}
                  onBlur={() => {
                    const matched = findGeneratorOption(generatorPickerValue || form.generator_id);
                    if (matched) {
                      setGeneratorPickerValue(matched.label);
                      setForm((f) => ({ ...f, generator_id: matched.id }));
                    }
                  }}
                  placeholder={`— ${t.generator} —`}
                  required
                  autoFocus
                />
                <datalist id="plan-generator-options">
                  {generatorOptions.map((option) => (
                    <option key={option.id} value={option.label} />
                  ))}
                </datalist>
              </div>
              <div className="col-12">
                <label className="form-label">{t.name} *</label>
                <input className="form-control" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">{t.ampere} *</label>
                <input type="number" className="form-control" value={form.ampere} onChange={e=>setForm(f=>({...f,ampere:e.target.value}))} required min={1} />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">{t.baseCostLBP} *</label>
                <input type="number" className="form-control" value={form.monthly_cost_lbp} onChange={e=>setForm(f=>({...f,monthly_cost_lbp:e.target.value}))} required min={0} step={0.01} />
              </div>
              <div className="col-12">
                <label className="form-label">{t.maintenanceLBP}</label>
                <input type="number" className="form-control" value={form.maintenance_lbp} onChange={e=>setForm(f=>({...f,maintenance_lbp:e.target.value}))} min={0} step={0.01} />
              </div>
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t.cancel}</button>
          <button type="submit" form="planForm" className="btn btn-primary">{editing ? t.save : t.create}</button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default OwnerPlans;

