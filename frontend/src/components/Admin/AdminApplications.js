import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { useLang } from '../../contexts/LangContext';

export default function AdminApplications({ apiBase = '/admin/registration-applications' }) {
  const { t } = useLang();
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ meter_number: '', plan_id: '', initial_kwh_consumed: 0 });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const r = await api.get(apiBase, { params: { status } }); setRows(r.data); }
    catch (e) { setError(e.response?.data?.error || t.failed); }
    finally { setLoading(false); }
  }, [apiBase, status, t.failed]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    let active = true;
    setDetail(null);
    setForm({ meter_number: '', plan_id: '', initial_kwh_consumed: 0 });
    if (selected) {
      api.get(`${apiBase}/${selected}`).then(r => { if (active) setDetail(r.data); })
        .catch(e => { if (active) setError(e.response?.data?.error || t.failed); });
    }
    return () => { active = false; };
  }, [apiBase, selected, t.failed]);
  const assign = async e => {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await api.put(`${apiBase}/${selected}/assign-meter`, {
        meter_number: form.meter_number.trim(), plan_id: Number(form.plan_id),
        initial_kwh_consumed: Number(form.initial_kwh_consumed),
      });
      setSelected(null); setNotice(t.assignmentSuccess); await load();
    } catch (err) { setError(err.response?.data?.error || t.failed); }
    finally { setBusy(false); }
  };
  return <div>
    <div className="page-header"><h4 className="page-title">{t.registrationApplications}</h4></div>
    {error && <div role="alert" className="alert alert-danger">{error}</div>}
    {notice && <div role="status" className="alert alert-success">{notice}</div>}
    <div className="d-flex flex-wrap gap-2 mb-3">
      <label htmlFor="application-status" className="visually-hidden">{t.status}</label>
      <select id="application-status" className="form-select w-auto" value={status} onChange={e => { setStatus(e.target.value); setSelected(null); }}>
        <option value="pending">{t.pendingMeterAssignment}</option>
        <option value="assigned">{t.applicationAssigned}</option>
        <option value="all">{t.allApplications}</option>
      </select>
      <button type="button" className="btn btn-outline-primary" onClick={load} disabled={loading || busy}>{t.refreshStatus}</button>
    </div>
    {loading ? <div className="spinner-border" role="status" /> : <div className="table-card"><div className="table-responsive">
      <table className="table mb-0"><thead><tr><th>{t.fullName}</th><th>{t.phone}</th><th>{t.requestedGenerator}</th><th>{t.status}</th><th>{t.meterNumber}</th><th>{t.actions}</th></tr></thead>
        <tbody>{rows.map(a => <tr key={a.id}>
          <td>{a.full_name}<div className="small text-muted">{a.username}</div></td>
          <td dir="ltr">{a.phone}</td><td>{a.generator_name}<div className="small text-muted">{a.location_name} — {a.provider_name}</div></td>
          <td>{a.status === 'pending' ? t.pendingMeterAssignment : t.applicationAssigned}</td>
          <td>{a.meter_number || '—'}</td><td>{a.status === 'pending' && <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => { setSelected(a.id); setNotice(''); setError(''); }}>{t.assignMeter}</button>}</td>
        </tr>)}{!rows.length && <tr><td colSpan="6" className="text-center p-4 text-muted">{t.noApplications}</td></tr>}</tbody>
      </table>
    </div></div>}
    {selected && <div className="table-card p-3 mt-4">
      <h5>{t.assignMeter}</h5>
      {!detail ? <div className="spinner-border" /> : <>
        <p><strong>{detail.application.full_name}</strong> — {detail.application.generator_name} ({detail.application.location_name})</p>
        <p>{t.installationAddress}: {detail.application.location_address}</p>
        {detail.plans.length ? <form onSubmit={assign}>
          <div className="row g-3">
            <div className="col-md-4"><label htmlFor="assignment-meter" className="form-label">{t.meterNumber}</label><input id="assignment-meter" className="form-control" required maxLength={100} pattern="[A-Za-z0-9][A-Za-z0-9._\-]{0,99}" value={form.meter_number} onChange={e => setForm({ ...form, meter_number: e.target.value })} /></div>
            <div className="col-md-4"><label htmlFor="assignment-plan" className="form-label">{t.plan}</label><select id="assignment-plan" className="form-select" required value={form.plan_id} onChange={e => setForm({ ...form, plan_id: e.target.value })}><option value="">{t.choosePlan}</option>{detail.plans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.ampere}A)</option>)}</select></div>
            <div className="col-md-4"><label htmlFor="assignment-reading" className="form-label">{t.initialMeterReading}</label><input id="assignment-reading" type="number" min="0" max="9999999999.99" step="0.01" className="form-control" required value={form.initial_kwh_consumed} onChange={e => setForm({ ...form, initial_kwh_consumed: e.target.value })} /></div>
          </div>
          <div className="d-flex gap-2 mt-3"><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t.saving : t.assignMeter}</button><button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => setSelected(null)}>{t.cancel}</button></div>
        </form> : <><div className="alert alert-info">{t.noApplicationPlans}</div><button type="button" className="btn btn-outline-secondary" onClick={() => setSelected(null)}>{t.cancel}</button></>}
      </>}
    </div>}
  </div>;
}
