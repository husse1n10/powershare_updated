import React, { useCallback, useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import api from '../../services/api';
import { useLang } from '../../contexts/LangContext';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';
import { formatDateTimeUtcPlus2 } from '../../utils/timezone';
import AppSelect from '../Shared/AppSelect';
import {
  FiPlus,
  FiUsers,
  FiDollarSign,
  FiTrash2,
  FiCheckCircle,
  FiXCircle,
  FiEdit2,
} from 'react-icons/fi';

function fmtUsd(n, digits = 2) {
  return `$${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function toUsd(lbp, rate) {
  const safeRate = Number(rate) > 0 ? Number(rate) : 89700;
  return Number(lbp || 0) / safeRate;
}

function fmtDualCurrency(lbp, rate, usdOverride = null) {
  const lbpValue = Number(lbp || 0);
  const usdValue = Number(usdOverride);
  const hasUsdOverride = usdOverride !== null
    && usdOverride !== undefined
    && usdOverride !== ''
    && Number.isFinite(usdValue)
    && usdValue >= 0
    && (usdValue > 0 || lbpValue <= 0);
  const usd = hasUsdOverride ? usdValue : toUsd(lbpValue, rate);
  return `${fmtUsd(usd)} (${Number(lbp || 0).toLocaleString()} LBP)`;
}

const EMPTY_WALLET = { collected_lbp: 0, collected_usd: 0, transferred_lbp: 0, balance_lbp: 0, pending_lbp: 0, available_lbp: 0 };
const EMPTY_TOTALS = { ...EMPTY_WALLET, pending_count: 0 };
const EMPTY_CREATE_FORM = { full_name: '', username: '', phone: '', password: '' };
const EMPTY_EDIT_FORM = { id: null, full_name: '', username: '', phone: '', password: '', is_active: true };

export default function OwnerCollector() {
  const { t } = useLang();
  const confirm = useConfirmDialog();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [activeSection, setActiveSection] = useState('collectors');
  const [collectorInfo, setCollectorInfo] = useState({ collectors: [], totals: EMPTY_TOTALS, usd_lbp_rate: 89700 });
  const [settlements, setSettlements] = useState([]);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_CREATE_FORM);

  const [editingCollector, setEditingCollector] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, sRes] = await Promise.all([api.get('/owner/collector'), api.get('/owner/collector/settlements')]);
      const payload = cRes.data || {};
      setCollectorInfo({
        collectors: Array.isArray(payload.collectors) ? payload.collectors : [],
        totals: { ...EMPTY_TOTALS, ...(payload.totals || {}) },
        usd_lbp_rate: Number(payload.usd_lbp_rate || 89700),
      });
      setSettlements(sRes.data || []);
    } catch (err) {
      setMsg({ type: 'danger', text: err.response?.data?.error || 'Failed' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setMsg(null);
    try {
      await api.post('/owner/collector/create', {
        full_name: form.full_name.trim(),
        username: form.username.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      setForm(EMPTY_CREATE_FORM);
      setMsg({ type: 'success', text: 'Collector account created.' });
      await load();
      setActiveSection('collectors');
    } catch (err) {
      setMsg({ type: 'danger', text: err.response?.data?.error || 'Failed' });
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (collector) => {
    setEditingCollector(collector);
    setEditForm({
      id: collector.id,
      full_name: collector.full_name || '',
      username: collector.username || '',
      phone: collector.phone || '',
      password: '',
      is_active: !!collector.is_active,
    });
  };

  const closeEditModal = () => {
    if (savingEdit) return;
    setEditingCollector(null);
    setEditForm(EMPTY_EDIT_FORM);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    setMsg(null);
    try {
      const payload = {
        full_name: editForm.full_name.trim(),
        username: editForm.username.trim(),
        phone: editForm.phone.trim(),
        is_active: editForm.is_active ? 1 : 0,
      };
      const trimmedPassword = String(editForm.password || '').trim();
      if (trimmedPassword) payload.password = trimmedPassword;

      await api.put(`/owner/collector/${editForm.id}`, payload);
      setMsg({ type: 'success', text: 'Collector updated.' });
      setEditingCollector(null);
      setEditForm(EMPTY_EDIT_FORM);
      await load();
    } catch (err) {
      setMsg({ type: 'danger', text: err.response?.data?.error || 'Failed' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteCollector = async (collector) => {
    const approved = await confirm({
      title: 'Delete Collector',
      message: `Delete ${collector.full_name}?`,
      confirmText: t.delete || 'Delete',
      intent: 'danger',
    });
    if (!approved) return;
    try {
      await api.delete(`/owner/collector/${collector.id}`);
      setMsg({ type: 'success', text: 'Deleted.' });
      load();
    } catch (err) {
      setMsg({ type: 'danger', text: err.response?.data?.error || 'Failed' });
    }
  };

  const handleConfirm = async (id) => {
    try {
      await api.put(`/owner/collector/settlements/${id}/confirm`);
      setMsg({ type: 'success', text: 'Confirmed.' });
      load();
    } catch (err) {
      setMsg({ type: 'danger', text: err.response?.data?.error || 'Failed' });
    }
  };

  const handleReject = async (id) => {
    try {
      await api.put(`/owner/collector/settlements/${id}/reject`);
      setMsg({ type: 'warning', text: 'Rejected.' });
      load();
    } catch (err) {
      setMsg({ type: 'danger', text: err.response?.data?.error || 'Failed' });
    }
  };

  const { collectors, totals } = collectorInfo;
  const usdRate = Number(collectorInfo.usd_lbp_rate || 89700);

  return (
    <div>
      <div className="page-header">
        <h4 className="page-title">{t.collector}</h4>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type} alert-dismissible mb-3`}>
          {msg.text}
          <button className="btn-close" onClick={() => setMsg(null)}>
            x
          </button>
        </div>
      )}

      <div className="row g-3 mb-4">
        {[
          { label: t.collected, value: fmtDualCurrency(totals.collected_lbp, usdRate, totals.collected_usd), color: 'var(--success)' },
          { label: t.transferred, value: fmtDualCurrency(totals.transferred_lbp, usdRate), color: 'var(--info)' },
          { label: t.pending, value: fmtDualCurrency(totals.pending_lbp, usdRate), color: 'var(--warning)' },
          { label: t.available, value: fmtDualCurrency(totals.available_lbp, usdRate), color: 'var(--accent)' },
        ].map((item) => (
          <div className="col-6 col-sm-3" key={item.label}>
            <div className="stat-card">
              <div className="stat-value" style={{ color: item.color, fontSize: '1rem', wordBreak: 'break-all' }}>
                {item.value}
              </div>
              <div className="stat-label">{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="section-tabs mb-3">
        <button className={`section-tab${activeSection === 'collectors' ? ' active' : ''}`} onClick={() => setActiveSection('collectors')}>
          <FiUsers /> {t.collectors} ({collectors.length})
        </button>
        <button className={`section-tab${activeSection === 'create' ? ' active' : ''}`} onClick={() => setActiveSection('create')}>
          <FiPlus /> {t.createCollector}
        </button>
        <button className={`section-tab${activeSection === 'settlements' ? ' active' : ''}`} onClick={() => setActiveSection('settlements')}>
          <FiDollarSign /> {t.settlements} ({settlements.length})
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <div className="spinner-border" />
        </div>
      ) : (
        <>
          {activeSection === 'collectors' && (
            <div className="table-card">
              <div className="d-lg-none" style={{ padding: '8px 10px' }}>
                {collectors.map((collector) => {
                  const wallet = { ...EMPTY_WALLET, ...(collector.wallet || {}) };
                  return (
                    <div className="data-card" key={collector.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div className="data-card-title">{collector.full_name}</div>
                          <div className="data-card-sub">
                            <code>{collector.username}</code> - {collector.phone || '-'}
                          </div>
                        </div>
                        <span className={collector.is_active ? 'badge-active' : 'badge-inactive'}>
                          {collector.is_active ? t.active : t.inactive}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6, marginTop: 8 }}>
                        {[
                          { label: t.collected, lbp: wallet.collected_lbp, usd: wallet.collected_usd },
                          { label: t.transferred, lbp: wallet.transferred_lbp },
                          { label: t.pending, lbp: wallet.pending_lbp },
                          { label: t.available, lbp: wallet.available_lbp },
                        ].map((item) => (
                          <div key={item.label} style={{ background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '6px 8px' }}>
                            <div
                              style={{
                                fontSize: '0.68rem',
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                              }}
                            >
                              {item.label}
                            </div>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)' }}>
                              {fmtDualCurrency(item.lbp, usdRate, item.usd)}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button className="btn btn-sm btn-outline-primary" onClick={() => openEditModal(collector)} title={t.edit}>
                          <FiEdit2 />
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteCollector(collector)} title={t.delete}>
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!collectors.length && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '36px 0', fontSize: '0.88rem' }}>
                    {t.noData}
                  </div>
                )}
              </div>

              <div className="d-none d-lg-block table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>{t.name}</th>
                      <th>{t.username || 'Username'}</th>
                      <th>{t.phone}</th>
                      <th>{t.collected}</th>
                      <th>{t.transferred}</th>
                      <th>{t.pending}</th>
                      <th>{t.available}</th>
                      <th>{t.status}</th>
                      <th>{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collectors.map((collector) => {
                      const wallet = { ...EMPTY_WALLET, ...(collector.wallet || {}) };
                      return (
                        <tr key={collector.id}>
                          <td style={{ fontWeight: 600 }}>{collector.full_name}</td>
                          <td>
                            <code>{collector.username}</code>
                          </td>
                          <td style={{ fontSize: '0.84rem' }}>{collector.phone || '-'}</td>
                          <td style={{ fontSize: '0.84rem' }}>{fmtDualCurrency(wallet.collected_lbp, usdRate, wallet.collected_usd)}</td>
                          <td style={{ fontSize: '0.84rem' }}>{fmtDualCurrency(wallet.transferred_lbp, usdRate)}</td>
                          <td style={{ fontSize: '0.84rem' }}>{fmtDualCurrency(wallet.pending_lbp, usdRate)}</td>
                          <td style={{ fontSize: '0.84rem', fontWeight: 600 }}>{fmtDualCurrency(wallet.available_lbp, usdRate)}</td>
                          <td>
                            <span className={collector.is_active ? 'badge-active' : 'badge-inactive'}>
                              {collector.is_active ? t.active : t.inactive}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-sm btn-outline-primary" onClick={() => openEditModal(collector)} title={t.edit}>
                                <FiEdit2 />
                              </button>
                              <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteCollector(collector)} title={t.delete}>
                                <FiTrash2 />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!collectors.length && (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px', fontSize: '0.85rem' }}>
                          {t.noData}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'create' && (
            <div className="table-card" style={{ padding: '20px' }}>
              <div style={{ marginBottom: 14, fontWeight: 600, color: 'var(--text)' }}>{t.createCollector}</div>
              <form onSubmit={handleCreate}>
                <div className="row g-3">
                  <div className="col-12 col-lg-3">
                    <label className="form-label">{t.fullName} *</label>
                    <input
                      className="form-control"
                      value={form.full_name}
                      onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="col-12 col-lg-3">
                    <label className="form-label">{t.username || 'Username'} *</label>
                    <input
                      className="form-control"
                      value={form.username}
                      onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                      required
                      minLength={3}
                      pattern="[A-Za-z0-9_.-]+"
                    />
                  </div>
                  <div className="col-12 col-lg-2">
                    <label className="form-label">{t.phone}</label>
                    <input
                      className="form-control"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+961XXXXXXXX"
                      pattern="[+]961[0-9]{6,10}"
                      title="Must start with +961"
                    />
                  </div>
                  <div className="col-12 col-lg-2">
                    <label className="form-label">{t.password} *</label>
                    <input
                      type="password"
                      className="form-control"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      required
                      minLength={4}
                      pattern="[A-Za-z0-9]{4,}"
                      title="At least 4 characters (letters/numbers only)"
                    />
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 5 }}>
                      Min 4 chars, letters/numbers only.
                    </div>
                  </div>
                  <div className="col-12 col-lg-2" style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button className="btn btn-primary w-100" style={{ justifyContent: 'center' }} disabled={creating}>
                      {creating ? <span className="spinner-border spinner-border-sm" /> : <><FiPlus /> {t.create}</>}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {activeSection === 'settlements' && (
            <div className="table-card">
              <div className="d-md-none" style={{ padding: '8px 10px' }}>
                {settlements.map((settlement) => (
                  <div className="data-card" key={settlement.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div className="data-card-title">{settlement.collector_name || '-'}</div>
                        <div className="data-card-sub">{formatDateTimeUtcPlus2(settlement.requested_at)}</div>
                      </div>
                      <span className={`badge-${settlement.status}`}>{settlement.status}</span>
                    </div>
                    <div className="data-card-row">
                      <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                        {fmtDualCurrency(settlement.amount_lbp, usdRate)}
                      </span>
                      {settlement.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button className="btn btn-sm btn-outline-success" onClick={() => handleConfirm(settlement.id)}>
                            <FiCheckCircle />
                          </button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => handleReject(settlement.id)}>
                            <FiXCircle />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {!settlements.length && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '36px 0', fontSize: '0.88rem' }}>
                    {t.noData}
                  </div>
                )}
              </div>

              <div className="d-none d-md-block table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Collector</th>
                      <th>Amount</th>
                      <th>{t.date}</th>
                      <th>{t.status}</th>
                      <th>{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.map((settlement) => (
                      <tr key={settlement.id}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>#{settlement.id}</td>
                        <td style={{ fontWeight: 500 }}>{settlement.collector_name || '-'}</td>
                        <td style={{ fontWeight: 600 }}>{fmtDualCurrency(settlement.amount_lbp, usdRate)}</td>
                        <td style={{ color: 'var(--text-sub)', fontSize: '0.82rem' }}>{formatDateTimeUtcPlus2(settlement.requested_at)}</td>
                        <td>
                          <span className={`badge-${settlement.status}`}>{settlement.status}</span>
                        </td>
                        <td>
                          {settlement.status === 'pending' ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-sm btn-outline-success" onClick={() => handleConfirm(settlement.id)} title="Confirm">
                                <FiCheckCircle />
                              </button>
                              <button className="btn btn-sm btn-outline-danger" onClick={() => handleReject(settlement.id)} title="Reject">
                                <FiXCircle />
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!settlements.length && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px', fontSize: '0.85rem' }}>
                          {t.noData}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <Modal show={!!editingCollector} onHide={closeEditModal}>
        <form onSubmit={handleSaveEdit}>
          <Modal.Header closeButton>
            <Modal.Title>
              {t.edit} {t.collector}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label">{t.fullName} *</label>
                <input
                  className="form-control"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div className="col-12">
                <label className="form-label">{t.username || 'Username'} *</label>
                <input
                  className="form-control"
                  value={editForm.username}
                  onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
                  required
                  minLength={3}
                  pattern="[A-Za-z0-9_.-]+"
                />
              </div>
              <div className="col-12">
                <label className="form-label">{t.phone}</label>
                <input
                  className="form-control"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+961XXXXXXXX"
                  pattern="[+]961[0-9]{6,10}"
                  title="Must start with +961"
                />
              </div>
              <div className="col-12">
                <label className="form-label">{t.password}</label>
                <input
                  type="password"
                  className="form-control"
                  value={editForm.password}
                  onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                  minLength={4}
                  pattern="[A-Za-z0-9]{4,}"
                  title="At least 4 characters (letters/numbers only)"
                  placeholder="Leave blank to keep existing password"
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 5 }}>
                  Min 4 chars, letters/numbers only.
                </div>
              </div>
              <div className="col-12">
                <label className="form-label">{t.status}</label>
                <AppSelect
                  className="form-select"
                  value={editForm.is_active ? '1' : '0'}
                  onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.value === '1' }))}
                >
                  <option value="1">{t.active}</option>
                  <option value="0">{t.inactive}</option>
                </AppSelect>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button className="btn btn-secondary" type="button" onClick={closeEditModal} disabled={savingEdit}>
              {t.cancel}
            </button>
            <button className="btn btn-primary" type="submit" disabled={savingEdit}>
              {savingEdit ? <span className="spinner-border spinner-border-sm" /> : t.saveChanges || t.save}
            </button>
          </Modal.Footer>
        </form>
      </Modal>
    </div>
  );
}
