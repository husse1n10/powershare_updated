import UiText from "../Shared/UiText";
import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { FiLink, FiSave } from 'react-icons/fi';
export default function OwnerCollectorAssignments() {
  const [collectors, setCollectors] = useState([]);
  const [generators, setGenerators] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [collectorId, setCollectorId] = useState('');
  const [generatorIds, setGeneratorIds] = useState([]);
  const [subscriberIds, setSubscriberIds] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const [c, g, s] = await Promise.all([api.get('/owner/collector'), api.get('/owner/generators'), api.get('/owner/subscribers')]);
      const cs = c.data?.collectors || [];
      setCollectors(cs);
      setGenerators(g.data || []);
      setSubscribers(s.data || []);
      if (cs.length && !collectorId) setCollectorId(String(cs[0].id));
    } catch (e) {
      setMsg({
        type: 'danger',
        text: e.response?.data?.error || 'Failed to load assignments.'
      });
    }
  };
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = useMemo(() => collectors.find(c => String(c.id) === String(collectorId)), [collectors, collectorId]);
  useEffect(() => {
    if (selected) {
      setGeneratorIds((selected.generator_ids || []).map(Number));
      setSubscriberIds((selected.subscriber_ids || []).map(Number));
    }
  }, [selected]);
  const toggle = (id, list, setList) => setList(list.includes(Number(id)) ? list.filter(x => x !== Number(id)) : [...list, Number(id)]);
  const save = async () => {
    if (!collectorId) return;
    setBusy(true);
    try {
      await api.put(`/owner/collector/${collectorId}/assignments`, {
        generator_ids: generatorIds,
        subscriber_ids: subscriberIds
      });
      setMsg({
        type: 'success',
        text: 'Collector assignments saved.'
      });
      await load();
    } catch (e) {
      setMsg({
        type: 'danger',
        text: e.response?.data?.error || 'Failed to save assignments.'
      });
    } finally {
      setBusy(false);
    }
  };
  return <div><div className="page-header"><div><h4 className="page-title"><FiLink /><UiText> Collector Assignments</UiText></h4><div className="text-muted"><UiText>Limit collectors to specific generators and/or subscribers. If no assignment is selected, the collector can work with all subscribers of the owner.</UiText></div></div><button className="btn btn-primary" onClick={save} disabled={!collectorId || busy}><FiSave /> <UiText>{busy ? 'Saving...' : 'Save Assignments'}</UiText></button></div>{msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
  <div className="table-card p-3 mb-3"><label className="form-label"><UiText>Collector</UiText></label><select className="form-select" style={{
        maxWidth: 480
      }} value={collectorId} onChange={e => setCollectorId(e.target.value)}>{collectors.map(c => <option key={c.id} value={c.id}>{c.full_name} ({c.username})</option>)}</select></div>
  <div className="row g-3"><div className="col-lg-5"><div className="table-card p-3 h-100"><h6><UiText>Generator Assignments</UiText></h6><p className="text-muted small"><UiText>Checking a generator gives the collector access to its active subscribers.</UiText></p>{generators.map(g => <label key={g.id} className="d-flex gap-2 align-items-start border-bottom py-2"><input type="checkbox" className="form-check-input" checked={generatorIds.includes(Number(g.id))} onChange={() => toggle(g.id, generatorIds, setGeneratorIds)} /><span><b>{g.name}</b><br /><small className="text-muted">{g.location_name}</small></span></label>)}{!generators.length && <div className="text-muted"><UiText>No generators.</UiText></div>}</div></div>
  <div className="col-lg-7"><div className="table-card p-3 h-100"><h6><UiText>Individual Subscriber Assignments</UiText></h6><p className="text-muted small"><UiText>Use this for exceptions or a collector assigned only to selected subscribers.</UiText></p><div style={{
            maxHeight: 480,
            overflow: 'auto'
          }}>{subscribers.map(s => <label key={s.subscriber_id} className="d-flex gap-2 align-items-start border-bottom py-2"><input type="checkbox" className="form-check-input" checked={subscriberIds.includes(Number(s.subscriber_id))} onChange={() => toggle(s.subscriber_id, subscriberIds, setSubscriberIds)} /><span><b>{s.full_name}</b> — <code>{s.meter_number || 'No meter'}</code><br /><small className="text-muted">{s.generator_name} / {s.plan_name} ({s.ampere}<UiText>A)</UiText></small></span></label>)}</div>{!subscribers.length && <div className="text-muted"><UiText>No subscribers.</UiText></div>}</div></div></div></div>;
}
