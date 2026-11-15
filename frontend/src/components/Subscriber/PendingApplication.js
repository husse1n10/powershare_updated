import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { useLang } from '../../contexts/LangContext';

export default function PendingApplication({ application, onRefresh }) {
  const { t } = useLang();
  const [destinations, setDestinations] = useState([]);
  const [form, setForm] = useState({generator_id:'',location_address:''});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const unselected = application.status === 'unselected';
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const {data} = await api.get('/subscriber/registration-destinations'); setDestinations(data); }
    catch (_) { setError(t.loadDestinationsFailed); }
    finally { setLoading(false); }
  }, [t.loadDestinationsFailed]);
  useEffect(() => { if (unselected) load(); }, [unselected, load]);
  const apply = async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { await api.post('/subscriber/registration-application', {...form,generator_id:Number(form.generator_id)}); onRefresh(); }
    catch (err) { setError(err.response?.data?.error || t.failed); }
    finally { setBusy(false); }
  };
  if (unselected) return <div>
    <div className="page-header"><h4 className="page-title">{t.chooseProviderTitle}</h4></div>
    <p className="alert alert-info">{t.chooseProviderInfo}</p>
    {error && <div role="alert" className="alert alert-danger">{error}</div>}
    {loading ? <div className="spinner-border" role="status"/> : !destinations.length ? <div className="table-card p-3"><p>{t.noDestinations}</p><button className="btn btn-outline-primary" onClick={load}>{t.refreshStatus}</button></div> : <form className="table-card p-3" onSubmit={apply}>
      <div className="mb-3"><label htmlFor="application-generator" className="form-label">{t.whereToApply}</label><select id="application-generator" className="form-select" required value={form.generator_id} onChange={e=>setForm({...form,generator_id:e.target.value})}><option value="">{t.chooseDestination}</option>{destinations.map(g=><option key={g.id} value={g.id}>{[g.location_name,g.name,g.provider_name].filter(Boolean).join(' — ')}</option>)}</select></div>
      <div className="mb-3"><label htmlFor="application-address" className="form-label">{t.installationAddress}</label><input id="application-address" className="form-control" required minLength={2} maxLength={400} autoComplete="street-address" value={form.location_address} onChange={e=>setForm({...form,location_address:e.target.value})}/></div>
      <button className="btn btn-primary" disabled={busy}>{busy?t.saving:t.submitApplication}</button>
    </form>}
  </div>;
  return <div>
    <div className="page-header"><h4 className="page-title">{t.subscriberDashboard}</h4></div>
    <div role="status" className="alert alert-info d-block"><h5>{t.pendingMeterAssignment}</h5><p className="mb-0">{t.pendingApplicationInfo}</p></div>
    <div className="table-card p-3">
      <h5>{t.applicationDetails}</h5>
      <p><strong>{t.requestedGenerator}:</strong> {application.generator_name}</p>
      <p><strong>{t.serviceArea}:</strong> {application.location_name}</p>
      <p><strong>{t.applicationProvider}:</strong> {application.provider_name || '—'}</p>
      <p><strong>{t.installationAddress}:</strong> {application.location_address}</p>
      <button type="button" className="btn btn-primary" onClick={onRefresh}>{t.refreshStatus}</button>
    </div>
  </div>;
}
