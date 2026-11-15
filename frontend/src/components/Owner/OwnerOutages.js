import UiText from "../Shared/UiText";
import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from 'react-bootstrap';
import api from '../../services/api';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';
import { FiPlus, FiEdit2, FiTrash2, FiClock } from 'react-icons/fi';
const EMPTY = {
  generator_id: '',
  schedule_type: 'one_time',
  day_of_week: '1',
  outage_date: '',
  start_time: '',
  end_time: '',
  notes: '',
  is_active: 1
};
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export default function OwnerOutages() {
  const confirm = useConfirmDialog();
  const [generators, setGenerators] = useState([]);
  const [selectedGen, setSelectedGen] = useState('');
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    api.get('/owner/generators').then(r => {
      setGenerators(r.data || []);
      if (r.data?.length) setSelectedGen(String(r.data[0].id));
    });
  }, []);
  useEffect(() => {
    if (selectedGen) api.get(`/owner/generators/${selectedGen}/outages`).then(r => setRows(r.data || [])).catch(() => {});
  }, [selectedGen]);
  const gen = useMemo(() => generators.find(g => String(g.id) === String(selectedGen)), [generators, selectedGen]);
  const reload = () => selectedGen && api.get(`/owner/generators/${selectedGen}/outages`).then(r => setRows(r.data || []));
  const open = (o = null) => {
    setEditing(o?.id || null);
    setForm(o ? {
      generator_id: o.generator_id,
      schedule_type: o.schedule_type,
      day_of_week: o.day_of_week ?? '1',
      outage_date: o.outage_date?.slice(0, 10) || '',
      start_time: String(o.start_time || '').slice(0, 5),
      end_time: String(o.end_time || '').slice(0, 5),
      notes: o.notes || '',
      is_active: o.is_active
    } : {
      ...EMPTY,
      generator_id: Number(selectedGen)
    });
    setShow(true);
  };
  const save = async e => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        generator_id: Number(form.generator_id),
        day_of_week: form.schedule_type === 'recurring' ? Number(form.day_of_week) : null,
        outage_date: form.schedule_type === 'one_time' ? form.outage_date : null
      };
      if (editing) await api.put(`/owner/outages/${editing}`, payload);else await api.post('/owner/outages', payload);
      setShow(false);
      setMsg({
        type: 'success',
        text: 'Outage schedule saved.'
      });
      reload();
    } catch (err) {
      setMsg({
        type: 'danger',
        text: err.response?.data?.error || 'Failed to save outage.'
      });
    }
  };
  const remove = async id => {
    if (!(await confirm({
      title: 'Delete Outage',
      message: 'Delete this outage schedule?',
      confirmText: 'Delete',
      intent: 'danger'
    }))) return;
    try {
      await api.delete(`/owner/outages/${id}`);
      reload();
    } catch (err) {
      setMsg({
        type: 'danger',
        text: err.response?.data?.error || 'Failed'
      });
    }
  };
  return <div><div className="page-header"><div><h4 className="page-title"><FiClock /><UiText> Outage Scheduling</UiText></h4><div className="text-muted"><UiText>One-time and recurring planned interruptions</UiText></div></div><button className="btn btn-primary" disabled={!selectedGen} onClick={() => open()}><FiPlus /><UiText> Add Outage</UiText></button></div>{msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}<div className="table-card mb-3 p-3"><label className="form-label"><UiText>Generator</UiText></label><select className="form-select" style={{
        maxWidth: 420
      }} value={selectedGen} onChange={e => setSelectedGen(e.target.value)}>{generators.map(g => <option key={g.id} value={g.id}>{g.name} — {g.location_name}</option>)}</select></div><div className="table-card"><div className="p-3"><b>{gen?.name || 'Generator'}<UiText> Outage Schedule</UiText></b></div><div className="table-responsive"><table className="table table-hover mb-0"><thead><tr><th><UiText>Type</UiText></th><th><UiText>Date / Day</UiText></th><th><UiText>Time</UiText></th><th><UiText>Notes</UiText></th><th><UiText>Status</UiText></th><th></th></tr></thead><tbody>{rows.map(o => <tr key={o.id}><td>{o.schedule_type}</td><td>{o.schedule_type === 'recurring' ? DAYS[Number(o.day_of_week)] : String(o.outage_date || '').slice(0, 10)}</td><td>{String(o.start_time).slice(0, 5)} – {String(o.end_time).slice(0, 5)}</td><td>{o.notes || '—'}</td><td><UiText>{o.is_active ? 'Active' : 'Inactive'}</UiText></td><td><div className="d-flex gap-1"><button className="btn btn-sm btn-outline-primary" onClick={() => open(o)}><FiEdit2 /></button><button className="btn btn-sm btn-outline-danger" onClick={() => remove(o.id)}><FiTrash2 /></button></div></td></tr>)}{!rows.length && <tr><td colSpan="6" className="text-center text-muted p-4"><UiText>No outage schedules for this generator.</UiText></td></tr>}</tbody></table></div></div>
  <Modal show={show} onHide={() => setShow(false)} centered><form onSubmit={save}><Modal.Header closeButton><Modal.Title><UiText>{editing ? 'Edit' : 'Add'}</UiText><UiText> Outage</UiText></Modal.Title></Modal.Header><Modal.Body><div className="mb-3"><label className="form-label"><UiText>Generator</UiText></label><select className="form-select" value={form.generator_id} onChange={e => setForm({
              ...form,
              generator_id: e.target.value
            })} required>{generators.map(g => <option value={g.id} key={g.id}>{g.name}</option>)}</select></div><div className="mb-3"><label className="form-label"><UiText>Schedule Type</UiText></label><select className="form-select" value={form.schedule_type} onChange={e => setForm({
              ...form,
              schedule_type: e.target.value
            })}><option value="one_time"><UiText>One-time</UiText></option><option value="recurring"><UiText>Recurring weekly</UiText></option></select></div>{form.schedule_type === 'recurring' ? <div className="mb-3"><label className="form-label"><UiText>Day of Week</UiText></label><select className="form-select" value={form.day_of_week} onChange={e => setForm({
              ...form,
              day_of_week: e.target.value
            })}>{DAYS.map((d, i) => <option value={i} key={d}>{d}</option>)}</select></div> : <div className="mb-3"><label className="form-label"><UiText>Outage Date</UiText></label><input type="date" className="form-control" value={form.outage_date} onChange={e => setForm({
              ...form,
              outage_date: e.target.value
            })} required /></div>}<div className="row g-2 mb-3"><div className="col"><label className="form-label"><UiText>Start</UiText></label><input type="time" className="form-control" value={form.start_time} onChange={e => setForm({
                ...form,
                start_time: e.target.value
              })} required /></div><div className="col"><label className="form-label"><UiText>End</UiText></label><input type="time" className="form-control" value={form.end_time} onChange={e => setForm({
                ...form,
                end_time: e.target.value
              })} required /></div></div><label className="form-label"><UiText>Notes</UiText></label><textarea className="form-control" value={form.notes} onChange={e => setForm({
            ...form,
            notes: e.target.value
          })} /></Modal.Body><Modal.Footer><button type="button" className="btn btn-secondary" onClick={() => setShow(false)}><UiText>Cancel</UiText></button><button className="btn btn-primary"><UiText>Save</UiText></button></Modal.Footer></form></Modal></div>;
}
