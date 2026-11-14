import React, { useCallback, useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import api from '../../services/api';
import { useLang } from '../../contexts/LangContext';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiHash } from 'react-icons/fi';
import AppSelect from '../Shared/AppSelect';

function fmtKwh(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

const PAGE_SIZE = 15;

export default function OwnerMainMeters() {
  const { t } = useLang();
  const confirm = useConfirmDialog();
  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({ meter_number: '', initial_kwh: '', notes: '', is_active: 1 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/owner/main-meters', {
        params: {
          include_inactive: 1,
          ...(search ? { search } : {}),
        },
      });
      setMeters(res.data || []);
    } catch (err) {
      setMsg({ type: 'danger', text: err.response?.data?.error || 'Failed to load' });
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    setPage(1);
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(meters.length / PAGE_SIZE));
  const paged = meters.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalLinkedSubscribersMeters = meters.reduce(
    (sum, meter) => sum + Number(meter.linked_subscribers_meter_total_kwh || 0),
    0
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ meter_number: '', initial_kwh: '', notes: '', is_active: 1 });
    setShowModal(true);
  };

  const openEdit = (meter) => {
    setEditing(meter);
    setForm({
      meter_number: meter.meter_number || '',
      initial_kwh: meter.initial_kwh ?? 0,
      notes: meter.notes || '',
      is_active: meter.is_active ? 1 : 0,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/owner/main-meters/${editing.id}`, form);
      } else {
        await api.post('/owner/main-meters', form);
      }
      setShowModal(false);
      setMsg({ type: 'success', text: editing ? 'Meter updated' : 'Meter created' });
      load();
    } catch (err) {
      setMsg({ type: 'danger', text: err.response?.data?.error || 'Failed' });
    }
  };

  const handleDelete = async (id) => {
    const approved = await confirm({
      title: 'Delete Main Meter',
      message: 'Delete this meter?',
      confirmText: t.delete || 'Delete',
      intent: 'danger',
    });
    if (!approved) return;

    try {
      await api.delete(`/owner/main-meters/${id}`);
      setMsg({ type: 'success', text: 'Meter deleted' });
      load();
    } catch (err) {
      setMsg({ type: 'danger', text: err.response?.data?.error || 'Failed' });
    }
  };

  return (
    <div>
      <div className="page-header">
        <h4 className="page-title">{t.mainMeters}</h4>
        <button className="btn btn-primary" onClick={openCreate}>
          <FiPlus /> {t.addMainMeter}
        </button>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type} alert-dismissible mb-3`}>
          {msg.text}
          <button className="btn-close" onClick={() => setMsg(null)}>x</button>
        </div>
      )}

      <div className="table-card">
        <div className="card-header-row">
          <div className="search-wrap" style={{ flex: 1, maxWidth: 300 }}>
            <span className="search-icon"><FiSearch /></span>
            <input
              className="form-control form-control-sm"
              placeholder={`${t.search}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {t.linkedSubscribersMetersTotal || 'Linked Subscribers Meter Sum'}: {fmtKwh(totalLinkedSubscribersMeters)} kWh
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{meters.length} meters</span>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <div className="spinner-border" />
          </div>
        ) : (
          <>
            <div className="d-md-none" style={{ padding: '8px 10px' }}>
              {paged.map((meter) => (
                <div className="data-card" key={meter.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="data-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FiHash style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <code>{meter.meter_number}</code>
                      </div>
                      <div className="data-card-sub">
                        {t.initialKwhLabel}: <strong style={{ color: 'var(--text)' }}>{fmtKwh(meter.initial_kwh)} kWh</strong>
                      </div>
                      <div className="data-card-sub">
                        {t.linkedSubscribersMetersTotal || 'Linked Subscribers Meter Sum'}:{' '}
                        <strong style={{ color: 'var(--text)' }}>{fmtKwh(meter.linked_subscribers_meter_total_kwh)} kWh</strong>
                      </div>
                    </div>
                    <span className={meter.is_active ? 'badge-active' : 'badge-inactive'}>
                      {meter.is_active ? t.active : t.inactive}
                    </span>
                  </div>

                  <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--text-sub)', overflowWrap: 'anywhere' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{t.notes}: </span>
                    <span>{meter.notes || '-'}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button className="btn btn-sm btn-outline-primary" onClick={() => openEdit(meter)}>
                      <FiEdit2 /> {t.edit}
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(meter.id)}>
                      <FiTrash2 /> {t.delete || 'Delete'}
                    </button>
                  </div>
                </div>
              ))}

              {meters.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '28px 0', fontSize: '0.86rem' }}>
                  {t.noData}
                </div>
              )}
            </div>

            <div className="d-none d-md-block table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>{t.meterNum}</th>
                    <th>{t.initialKwhLabel}</th>
                    <th>{t.linkedSubscribersMetersTotal || 'Linked Subscribers Meter Sum'}</th>
                    <th>{t.notes}</th>
                    <th>{t.status}</th>
                    <th>{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((meter) => (
                    <tr key={meter.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <FiHash style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <code>{meter.meter_number}</code>
                        </div>
                      </td>
                      <td>{fmtKwh(meter.initial_kwh)} kWh</td>
                      <td>{fmtKwh(meter.linked_subscribers_meter_total_kwh)} kWh</td>
                      <td style={{ color: 'var(--text-sub)', fontSize: '0.82rem' }}>{meter.notes || '-'}</td>
                      <td>
                        <span className={meter.is_active ? 'badge-active' : 'badge-inactive'}>
                          {meter.is_active ? t.active : t.inactive}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <button className="btn btn-sm btn-outline-primary" onClick={() => openEdit(meter)}><FiEdit2 /></button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(meter.id)}><FiTrash2 /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {meters.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px', fontSize: '0.85rem' }}>
                        {t.noData}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination-wrap">
                <span className="pagination-info">
                  {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, meters.length)} / {meters.length}
                </span>
                <div className="pagination-btns">
                  <button className="page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>{'<'}</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                    return p >= 1 && p <= totalPages ? (
                      <button key={p} className={`page-btn${page === p ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                    ) : null;
                  })}
                  <button className="page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>{'>'}</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{editing ? t.edit : t.addMainMeter}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <form id="meterForm" onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label">{t.meterNum} *</label>
                <input
                  className="form-control"
                  value={form.meter_number}
                  onChange={(e) => setForm((f) => ({ ...f, meter_number: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div className="col-12">
                <label className="form-label">{t.initialKwhLabel}</label>
                <input
                  type="number"
                  className="form-control"
                  value={form.initial_kwh}
                  onChange={(e) => setForm((f) => ({ ...f, initial_kwh: e.target.value }))}
                  min={0}
                  step={0.01}
                />
              </div>
              <div className="col-12">
                <label className="form-label">{t.notes}</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label">{t.status}</label>
                <AppSelect
                  className="form-select"
                  value={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: Number(e.target.value) }))}
                >
                  <option value={1}>{t.active}</option>
                  <option value={0}>{t.inactive}</option>
                </AppSelect>
              </div>
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t.cancel}</button>
          <button type="submit" form="meterForm" className="btn btn-primary">{t.save}</button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
