import { PASSWORD_PATTERN } from '../../utils/passwordPolicy';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal } from 'react-bootstrap';
import api from '../../services/api';
import { useLang } from '../../contexts/LangContext';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiUserX, FiUserCheck, FiKey } from 'react-icons/fi';

const PAGE_SIZE = 15;

function normalizeOptionValue(value) {
  return String(value || '').trim().toLowerCase();
}

export default function OwnerSubscribers() {
  const { t } = useLang();
  const confirm = useConfirmDialog();
  const [subscribers, setSubscribers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [mainMeters, setMainMeters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState(null);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({
    full_name:'', phone:'', location_address:'', plan_id:'', meter_number:'', main_meter_id:'', initial_kwh_consumed:'',
    fixed_amount_enabled:false, fixed_amount_usd:'',
  });
  const [editForm, setEditForm] = useState({
    full_name:'', phone:'', location_address:'', meter_number:'', main_meter_id:'', plan_id:'',
    fixed_amount_enabled:false, fixed_amount_usd:'',
  });
  const [planPickerValue, setPlanPickerValue] = useState('');
  const [mainMeterPickerValue, setMainMeterPickerValue] = useState('');
  const [editMainMeterPickerValue, setEditMainMeterPickerValue] = useState('');
  const [accountSubscriber, setAccountSubscriber] = useState(null);
  const [accountForm, setAccountForm] = useState({ username:'', password:'' });
  const [accountBusy, setAccountBusy] = useState(false);

  const planOptions = useMemo(
    () => (plans || []).map((p) => ({
      id: String(p.id),
      label: `${p.generator_name} - ${p.name} (${p.ampere}A) | ${Number(p.monthly_cost_lbp || 0).toLocaleString()} LBP/mo`,
    })),
    [plans]
  );

  const mainMeterOptions = useMemo(
    () => (mainMeters || []).map((m) => ({
      id: String(m.id),
      label: String(m.meter_number || ''),
    })),
    [mainMeters]
  );

  const findPlanOption = useCallback(
    (value) => {
      const normalized = normalizeOptionValue(value);
      if (!normalized) return null;
      return planOptions.find((option) => (
        normalizeOptionValue(option.id) === normalized
        || normalizeOptionValue(option.label) === normalized
      )) || null;
    },
    [planOptions]
  );

  const findMainMeterOption = useCallback(
    (value) => {
      const normalized = normalizeOptionValue(value);
      if (!normalized) return null;
      return mainMeterOptions.find((option) => (
        normalizeOptionValue(option.id) === normalized
        || normalizeOptionValue(option.label) === normalized
      )) || null;
    },
    [mainMeterOptions]
  );

  const load = useCallback(async () => {
    try {
      const [subsRes, plansRes, metersRes] = await Promise.all([
        api.get('/owner/subscribers', { params: search ? { search } : {} }),
        api.get('/owner/plans'),
        api.get('/owner/main-meters'),
      ]);
      setSubscribers(subsRes.data);
      setPlans(plansRes.data);
      setMainMeters(metersRes.data || []);
    } catch (_) {} finally { setLoading(false); }
  }, [search]);

  useEffect(() => {
    setPage(1);
    const timer = setTimeout(() => load(), 400);
    return () => clearTimeout(timer);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(subscribers.length / PAGE_SIZE));
  const paged = subscribers.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const handleCreate = async (e) => {
    e.preventDefault();
    const selectedPlan = findPlanOption(planPickerValue || form.plan_id);
    if (!selectedPlan) {
      setMsg({ type:'danger', text:'Please select a valid plan from the list.' });
      return;
    }

    const mainMeterRaw = String(mainMeterPickerValue || '').trim();
    const selectedMainMeter = findMainMeterOption(mainMeterRaw || form.main_meter_id);
    if (mainMeterRaw && !selectedMainMeter) {
      setMsg({ type:'danger', text:'Please select a valid main electricity meter from the list.' });
      return;
    }

    try {
      await api.post('/owner/subscribers/create', {
        ...form,
        plan_id: selectedPlan.id,
        main_meter_id: selectedMainMeter ? selectedMainMeter.id : null,
        fixed_amount_enabled: !!form.fixed_amount_enabled,
        fixed_amount_usd: form.fixed_amount_enabled ? form.fixed_amount_usd : 0,
      });
      setShowModal(false);
      setMsg({ type:'success', text:'Subscriber created successfully.' });
      load();
    } catch (err) { setMsg({ type:'danger', text: err.response?.data?.error||'Failed' }); }
  };

  const openEditModal = (s) => {
    const matchedMainMeter = mainMeterOptions.find((option) => option.id === String(s.main_meter_id || ''));
    setEditingSubscriber(s);
    setEditForm({
      full_name:s.full_name||'',
      phone:s.phone||'',
      location_address:s.location_address||'',
      meter_number:s.meter_number||'',
      main_meter_id:s.main_meter_id||'',
      plan_id:s.plan_id||'',
      fixed_amount_enabled:Number(s.fixed_amount_enabled)===1,
      fixed_amount_usd:Number(s.fixed_amount_usd||0)>0 ? String(Number(s.fixed_amount_usd)) : '',
    });
    setEditMainMeterPickerValue(matchedMainMeter?.label || (s.main_meter_number ? String(s.main_meter_number) : ''));
    setShowEditModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editingSubscriber?.subscriber_id) return;

    const editMainMeterRaw = String(editMainMeterPickerValue || '').trim();
    const selectedEditMainMeter = findMainMeterOption(editMainMeterRaw || editForm.main_meter_id);
    if (editMainMeterRaw && !selectedEditMainMeter) {
      setMsg({ type:'danger', text:'Please select a valid main electricity meter from the list.' });
      return;
    }

    try {
      await api.put(`/owner/subscribers/${editingSubscriber.subscriber_id}`, {
        ...editForm,
        main_meter_id: selectedEditMainMeter ? selectedEditMainMeter.id : null,
        fixed_amount_enabled: !!editForm.fixed_amount_enabled,
        fixed_amount_usd: editForm.fixed_amount_enabled ? editForm.fixed_amount_usd : 0,
      });
      setShowEditModal(false);
      setMsg({ type:'success', text:'Subscriber updated.' });
      load();
    } catch (err) { setMsg({ type:'danger', text: err.response?.data?.error||'Failed' }); }
  };

  const handleEnd = async (id) => {
    const approved = await confirm({
      title: 'End Subscription',
      message: 'End this subscription?',
      confirmText: t.end,
      intent: 'warning',
    });
    if (!approved) return;
    try { await api.delete(`/owner/subscriptions/${id}`); setMsg({ type:'success', text:'Subscription ended.' }); load(); }
    catch (err) { setMsg({ type:'danger', text: err.response?.data?.error||'Failed' }); }
  };

  const handleDelete = async (id) => {
    const approved = await confirm({
      title: 'Delete Subscriber',
      message: 'Delete this subscriber permanently?',
      confirmText: t.delete,
      intent: 'danger',
    });
    if (!approved) return;
    try { await api.delete(`/owner/subscriptions/${id}/permanent`); setMsg({ type:'success', text:'Deleted.' }); load(); }
    catch (err) { setMsg({ type:'danger', text: err.response?.data?.error||'Failed' }); }
  };

  const handleResubscribe = async (id) => {
    const approved = await confirm({
      title: 'Re-subscribe',
      message: 'Re-subscribe this subscriber?',
      confirmText: t.reSubscribe,
      intent: 'success',
    });
    if (!approved) return;
    try { await api.post(`/owner/subscriptions/${id}/resubscribe`); setMsg({ type:'success', text:'Re-subscribed.' }); load(); }
    catch (err) { setMsg({ type:'danger', text: err.response?.data?.error||'Failed' }); }
  };


  const openAccountModal = (subscriber) => {
    setAccountSubscriber(subscriber);
    const base = String(subscriber.full_name || '').toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,'');
    setAccountForm({ username: base || `subscriber${subscriber.subscriber_id}`, password:'' });
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!accountSubscriber) return;
    setAccountBusy(true);
    try {
      await api.post(`/owner/subscribers/${accountSubscriber.subscriber_id}/account`, accountForm);
      setMsg({ type:'success', text:'Subscriber portal account created.' });
      setAccountSubscriber(null);
      setAccountForm({ username:'', password:'' });
      await load();
    } catch (err) {
      setMsg({ type:'danger', text: err.response?.data?.error || 'Failed to create subscriber account.' });
    } finally { setAccountBusy(false); }
  };

  const resetForm = () => {
    setForm({
      full_name:'', phone:'', location_address:'', plan_id:'', meter_number:'', main_meter_id:'', initial_kwh_consumed:'',
      fixed_amount_enabled:false, fixed_amount_usd:'',
    });
    setPlanPickerValue('');
    setMainMeterPickerValue('');
  };

  const PaginationBar = () => totalPages <= 1 ? null : (
    <div className="pagination-wrap">
      <span className="pagination-info">{(page-1)*PAGE_SIZE+1}-{Math.min(page*PAGE_SIZE, subscribers.length)} / {subscribers.length}</span>
      <div className="pagination-btns">
        <button className="page-btn" onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1}>{'<'}</button>
        {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
          const p = Math.max(1,Math.min(totalPages-4,page-2))+i;
          return (p>=1&&p<=totalPages) ? <button key={p} className={`page-btn${page===p?' active':''}`} onClick={()=>setPage(p)}>{p}</button> : null;
        })}
        <button className="page-btn" onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>{'>'}</button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h4 className="page-title">{t.subscribers}</h4>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <FiPlus /> {t.createSubscriber}
        </button>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type} alert-dismissible mb-3`}>
          {msg.text}<button className="btn-close" onClick={() => setMsg(null)}>x</button>
        </div>
      )}

      <div className="table-card">
        <div className="card-header-row">
          <div className="search-wrap" style={{ flex:1, maxWidth:320 }}>
            <span className="search-icon"><FiSearch /></span>
            <input className="form-control form-control-sm" placeholder={`${t.search}...`} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span style={{ fontSize:'0.78rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{subscribers.length} {t.subscribers}</span>
        </div>

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'32px 0' }}><div className="spinner-border" /></div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="d-lg-none" style={{ padding:'8px 10px' }}>
              {paged.map(s => (
                <div className="data-card" key={s.subscription_id}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                    <div style={{ minWidth:0 }}>
                      <div className="data-card-title">{s.full_name}</div>
                      <div className="data-card-sub">{s.phone || '-'} - {s.plan_name} ({s.ampere}A)</div>
                      <div style={{ fontSize:'0.76rem', color:'var(--text-muted)' }}>{s.generator_name}</div>
                      {Number(s.fixed_amount_enabled) === 1 && (
                        <div style={{ fontSize:'0.76rem', color:'var(--accent)', marginTop:3 }}>
                          Fixed bill: ${Number(s.fixed_amount_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} (no VAT)
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
                      <span className={s.sub_active ? 'badge-active' : 'badge-ended'}>{s.sub_active ? t.active : t.ended}</span>
                      {Number(s.unpaid_bills || 0) > 0 && <span className="badge-unpaid">{Number(s.unpaid_bills || 0)}</span>}
                    </div>
                  </div>
                  {(s.meter_number || s.main_meter_number) && (
                    <div style={{ fontSize:'0.76rem', color:'var(--text-muted)', marginTop:5 }}>
                      {s.meter_number && <span>Meter: <code>{s.meter_number}</code></span>}
                      {s.meter_number && s.main_meter_number && <span style={{ margin:'0 6px' }}>-</span>}
                      {s.main_meter_number && <span>Main: <code>{s.main_meter_number}</code></span>}
                    </div>
                  )}
                  <div style={{ display:'flex', gap:5, marginTop:8 }}>
                    <button className="btn btn-sm btn-outline-primary" onClick={() => openEditModal(s)} title={t.edit}><FiEdit2 /></button>
                    {!s.subscriber_username && <button className="btn btn-sm btn-outline-success" onClick={() => openAccountModal(s)} title="Create subscriber login"><FiKey /></button>}
                    {s.sub_active
                      ? <button className="btn btn-sm btn-outline-secondary" onClick={() => handleEnd(s.subscription_id)} title={t.end}><FiUserX /></button>
                      : <button className="btn btn-sm btn-outline-success" onClick={() => handleResubscribe(s.subscription_id)} title={t.reSubscribe}><FiUserCheck /></button>
                    }
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(s.subscription_id)} title={t.delete}><FiTrash2 /></button>
                  </div>
                </div>
              ))}
              {subscribers.length === 0 && (
                <div style={{ textAlign:'center', color:'var(--text-muted)', padding:'36px 0', fontSize:'0.88rem' }}>{t.noSubscribers}</div>
              )}
            </div>

            {/* Desktop table */}
            <div className="d-none d-lg-block table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>{t.fullName}</th><th>{t.phone}</th><th>{t.plan}</th>
                    <th>{t.generator}</th><th>{t.meterNum}</th><th>{t.mainMeterNum}</th>
                    <th>{t.unpaidBills}</th><th>{t.status}</th><th>{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(s => (
                    <tr key={s.subscription_id}>
                      <td style={{ fontWeight:500 }}>{s.full_name}</td>
                      <td style={{ color:'var(--text-sub)', fontSize:'0.84rem' }}>{s.phone || '-'}</td>
                      <td>
                        {s.plan_name} <span style={{ color:'var(--text-muted)', fontSize:'0.75rem' }}>({s.ampere}A)</span>
                        {Number(s.fixed_amount_enabled) === 1 && (
                          <div style={{ fontSize:'0.74rem', color:'var(--accent)' }}>
                            Fixed: ${Number(s.fixed_amount_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize:'0.84rem' }}>{s.generator_name}</td>
                      <td><code>{s.meter_number||'-'}</code></td>
                      <td><code>{s.main_meter_number||'-'}</code></td>
                      <td>
                        {Number(s.unpaid_bills || 0) > 0
                          ? <span className="badge-unpaid">{Number(s.unpaid_bills || 0)}</span>
                          : <span style={{ color:'var(--text-muted)', fontSize:'0.78rem' }}>0</span>}
                      </td>
                      <td><span className={s.sub_active ? 'badge-active' : 'badge-ended'}>{s.sub_active ? t.active : t.ended}</span></td>
                      <td>
                        <div style={{ display:'flex', gap:4 }}>
                          <button className="btn btn-sm btn-outline-primary" onClick={() => openEditModal(s)} title={t.edit}><FiEdit2 /></button>
                          {!s.subscriber_username && <button className="btn btn-sm btn-outline-success" onClick={() => openAccountModal(s)} title="Create subscriber login"><FiKey /></button>}
                          {s.sub_active
                            ? <button className="btn btn-sm btn-outline-secondary" onClick={() => handleEnd(s.subscription_id)} title={t.end}><FiUserX /></button>
                            : <button className="btn btn-sm btn-outline-success" onClick={() => handleResubscribe(s.subscription_id)} title={t.reSubscribe}><FiUserCheck /></button>}
                          <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(s.subscription_id)} title={t.delete}><FiTrash2 /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {subscribers.length === 0 && (
                    <tr><td colSpan={9} style={{ textAlign:'center', color:'var(--text-muted)', padding:'32px', fontSize:'0.85rem' }}>{t.noSubscribers}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationBar />
          </>
        )}
      </div>

      {/* Create Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>{t.createSubscriber}</Modal.Title></Modal.Header>
        <Modal.Body>
          <form id="subForm" onSubmit={handleCreate}>
            <div className="row g-3">
              <div className="col-12 col-sm-6">
                <label className="form-label">{t.fullName} *</label>
                <input className="form-control" value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} required autoFocus />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">{t.phone}</label>
                <input
                  className="form-control"
                  value={form.phone}
                  onChange={e=>setForm(f=>({...f,phone:e.target.value}))}
                  placeholder="+961XXXXXXXX"
                  pattern="[+]961[0-9]{6,10}"
                  title="Must start with +961"
                />
              </div>
              <div className="col-12">
                <label className="form-label">{t.locationAddress} *</label>
                <input className="form-control" value={form.location_address} onChange={e=>setForm(f=>({...f,location_address:e.target.value}))} required />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">{t.assignPlan} *</label>
                <input
                  className="form-control"
                  list="subscriber-plan-options"
                  value={planPickerValue}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setPlanPickerValue(nextValue);
                    const matched = findPlanOption(nextValue);
                    setForm((f) => ({ ...f, plan_id: matched ? matched.id : '' }));
                  }}
                  onBlur={() => {
                    const matched = findPlanOption(planPickerValue);
                    if (matched) {
                      setPlanPickerValue(matched.label);
                      setForm((f) => ({ ...f, plan_id: matched.id }));
                    }
                  }}
                  placeholder={t.selectPlan}
                  required
                />
                <datalist id="subscriber-plan-options">
                  {planOptions.map((option) => (
                    <option key={option.id} value={option.label} />
                  ))}
                </datalist>
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">{t.mainElecMeter}</label>
                <input
                  className="form-control"
                  list="subscriber-main-meter-options"
                  value={mainMeterPickerValue}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setMainMeterPickerValue(nextValue);
                    const matched = findMainMeterOption(nextValue);
                    setForm((f) => ({ ...f, main_meter_id: matched ? matched.id : '' }));
                  }}
                  onBlur={() => {
                    const raw = String(mainMeterPickerValue || '').trim();
                    if (!raw) {
                      setForm((f) => ({ ...f, main_meter_id: '' }));
                      return;
                    }
                    const matched = findMainMeterOption(raw);
                    if (matched) {
                      setMainMeterPickerValue(matched.label);
                      setForm((f) => ({ ...f, main_meter_id: matched.id }));
                    }
                  }}
                  placeholder={`- ${t.optional} -`}
                />
                <datalist id="subscriber-main-meter-options">
                  {mainMeterOptions.map((option) => (
                    <option key={option.id} value={option.label} />
                  ))}
                </datalist>
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">{t.meterNumber}</label>
                <input className="form-control" value={form.meter_number} onChange={e=>setForm(f=>({...f,meter_number:e.target.value}))} />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">{t.initialKwh}</label>
                <input type="number" className="form-control" value={form.initial_kwh_consumed} onChange={e=>setForm(f=>({...f,initial_kwh_consumed:e.target.value}))} min={0} step={0.01} />
              </div>
              <div className="col-12">
                <div className="form-check" style={{ marginTop:4 }}>
                  <input
                    id="create-fixed-enabled"
                    type="checkbox"
                    className="form-check-input"
                    checked={!!form.fixed_amount_enabled}
                    onChange={e=>setForm(f=>({
                      ...f,
                      fixed_amount_enabled:e.target.checked,
                      fixed_amount_usd:e.target.checked ? f.fixed_amount_usd : '',
                    }))}
                  />
                  <label htmlFor="create-fixed-enabled" className="form-check-label">
                    Enable fixed bill amount (USD) for this subscriber
                  </label>
                </div>
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">Fixed Amount (USD)</label>
                <input
                  type="number"
                  className="form-control"
                  value={form.fixed_amount_usd}
                  onChange={e=>setForm(f=>({...f,fixed_amount_usd:e.target.value}))}
                  min={0}
                  step={0.01}
                  disabled={!form.fixed_amount_enabled}
                  required={!!form.fixed_amount_enabled}
                  placeholder="e.g. 10"
                />
                <div style={{ fontSize:'0.74rem', color:'var(--text-muted)', marginTop:4 }}>
                  When enabled, monthly bill uses this amount only (no VAT, no kWh pricing).
                </div>
              </div>
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t.cancel}</button>
          <button type="submit" form="subForm" className="btn btn-primary">{t.createAndAssign}</button>
        </Modal.Footer>
      </Modal>

      {/* Edit Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>{t.editSubscriber}</Modal.Title></Modal.Header>
        <Modal.Body>
          <form id="editSubForm" onSubmit={handleEdit}>
            <div className="row g-3">
              <div className="col-12 col-sm-6">
                <label className="form-label">{t.fullName} *</label>
                <input className="form-control" value={editForm.full_name} onChange={e=>setEditForm(f=>({...f,full_name:e.target.value}))} required autoFocus />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">{t.phone}</label>
                <input
                  className="form-control"
                  value={editForm.phone}
                  onChange={e=>setEditForm(f=>({...f,phone:e.target.value}))}
                  placeholder="+961XXXXXXXX"
                  pattern="[+]961[0-9]{6,10}"
                  title="Must start with +961"
                />
              </div>
              <div className="col-12">
                <label className="form-label">{t.locationAddress} *</label>
                <input className="form-control" value={editForm.location_address} onChange={e=>setEditForm(f=>({...f,location_address:e.target.value}))} required />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">{t.plan || 'Plan'} *</label>
                <select className="form-select" value={editForm.plan_id} onChange={e=>setEditForm(f=>({...f,plan_id:e.target.value}))} required>
                  {plans.map(p=><option key={p.id} value={p.id}>{p.generator_name} - {p.name} ({p.ampere}A)</option>)}
                </select>
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">{t.meterNumber}</label>
                <input className="form-control" value={editForm.meter_number} onChange={e=>setEditForm(f=>({...f,meter_number:e.target.value}))} />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">{t.mainElecMeter}</label>
                <input
                  className="form-control"
                  list="subscriber-edit-main-meter-options"
                  value={editMainMeterPickerValue}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setEditMainMeterPickerValue(nextValue);
                    const matched = findMainMeterOption(nextValue);
                    setEditForm((f) => ({ ...f, main_meter_id: matched ? matched.id : '' }));
                  }}
                  onBlur={() => {
                    const raw = String(editMainMeterPickerValue || '').trim();
                    if (!raw) {
                      setEditForm((f) => ({ ...f, main_meter_id: '' }));
                      return;
                    }
                    const matched = findMainMeterOption(raw);
                    if (matched) {
                      setEditMainMeterPickerValue(matched.label);
                      setEditForm((f) => ({ ...f, main_meter_id: matched.id }));
                    }
                  }}
                  placeholder={`- ${t.optional} -`}
                />
                <datalist id="subscriber-edit-main-meter-options">
                  {mainMeterOptions.map((option) => (
                    <option key={option.id} value={option.label} />
                  ))}
                </datalist>
              </div>
              <div className="col-12">
                <div className="form-check" style={{ marginTop:4 }}>
                  <input
                    id="edit-fixed-enabled"
                    type="checkbox"
                    className="form-check-input"
                    checked={!!editForm.fixed_amount_enabled}
                    onChange={e=>setEditForm(f=>({
                      ...f,
                      fixed_amount_enabled:e.target.checked,
                      fixed_amount_usd:e.target.checked ? f.fixed_amount_usd : '',
                    }))}
                  />
                  <label htmlFor="edit-fixed-enabled" className="form-check-label">
                    Enable fixed bill amount (USD) for this subscriber
                  </label>
                </div>
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">Fixed Amount (USD)</label>
                <input
                  type="number"
                  className="form-control"
                  value={editForm.fixed_amount_usd}
                  onChange={e=>setEditForm(f=>({...f,fixed_amount_usd:e.target.value}))}
                  min={0}
                  step={0.01}
                  disabled={!editForm.fixed_amount_enabled}
                  required={!!editForm.fixed_amount_enabled}
                  placeholder="e.g. 10"
                />
                <div style={{ fontSize:'0.74rem', color:'var(--text-muted)', marginTop:4 }}>
                  When enabled, monthly bill uses this amount only (no VAT, no kWh pricing).
                </div>
              </div>
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>{t.cancel}</button>
          <button type="submit" form="editSubForm" className="btn btn-primary">{t.saveChanges}</button>
        </Modal.Footer>
      </Modal>

      <Modal show={!!accountSubscriber} onHide={() => !accountBusy && setAccountSubscriber(null)} centered>
        <form onSubmit={handleCreateAccount}>
          <Modal.Header closeButton><Modal.Title>Create Subscriber Portal Account</Modal.Title></Modal.Header>
          <Modal.Body>
            <div className="alert alert-info">Create login credentials for <b>{accountSubscriber?.full_name}</b>. This links the portal account to the existing subscriber record.</div>
            <div className="mb-3"><label className="form-label">Username</label><input className="form-control" minLength={3} pattern="[A-Za-z0-9_.-]+" value={accountForm.username} onChange={e=>setAccountForm(f=>({...f,username:e.target.value}))} required autoFocus /></div>
            <div className="mb-2"><label className="form-label">Temporary Password</label><input type="password" className="form-control" minLength={8} maxLength={72} pattern={PASSWORD_PATTERN} value={accountForm.password} onChange={e=>setAccountForm(f=>({...f,password:e.target.value}))} required /></div>
            <small className="text-muted">The subscriber can change the password from Profile & Security after login.</small>
          </Modal.Body>
          <Modal.Footer><button type="button" className="btn btn-secondary" onClick={()=>setAccountSubscriber(null)} disabled={accountBusy}>Cancel</button><button className="btn btn-primary" disabled={accountBusy}>{accountBusy?'Creating...':'Create Account'}</button></Modal.Footer>
        </form>
      </Modal>
    </div>
  );
}
