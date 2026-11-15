import UiText from "../Shared/UiText";
import { PASSWORD_PATTERN } from '../../utils/passwordPolicy';
import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from 'react-bootstrap';
import api from '../../services/api';
import { useLang } from '../../contexts/LangContext';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';
import { useAuth } from '../../contexts/AuthContext';
import { MONTHS_EN, MONTHS_AR } from '../../i18n';
import { getCurrentMonthYearUtcPlus2, formatDateTimeUtcPlus2 } from '../../utils/timezone';
import AppSelect from '../Shared/AppSelect';
import { FiUsers, FiZap, FiDollarSign, FiAlertCircle, FiBarChart2, FiFileText, FiSearch, FiPlus, FiCheck, FiEdit2, FiToggleLeft, FiToggleRight, FiSettings, FiSave, FiShield, FiUser } from 'react-icons/fi';

// ── ADMIN DASHBOARD ────────────────────────────────────────────────────────────
export function AdminDashboard() {
  const {
    t,
    lang
  } = useLang();
  const confirm = useConfirmDialog();
  const MONTHS = lang === 'ar' ? MONTHS_AR : MONTHS_EN;
  const current = getCurrentMonthYearUtcPlus2();
  const [period, setPeriod] = useState({
    month: current.month,
    year: current.year
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/dashboard', {
        params: period
      });
      setData(res.data);
    } catch (err) {
      setMsg({
        type: 'danger',
        text: err.response?.data?.error || 'Failed'
      });
    } finally {
      setLoading(false);
    }
  }, [period]);
  useEffect(() => {
    load();
  }, [load]);
  const handleConfirmCollection = async row => {
    if (row.status === 'received') return;
    const approved = await confirm({
      title: t.confirmFeeCollection || 'Confirm Fee Collection',
      message: `Confirm fee from "${row.owner_name}"?`,
      confirmText: t.confirmCollection,
      intent: 'warning'
    });
    if (!approved) return;
    try {
      setConfirmingId(row.id);
      await api.put(`/admin/platform-fees/${row.id}/confirm`, {});
      setMsg({
        type: 'success',
        text: 'Marked as received.'
      });
      await load();
    } catch (err) {
      setMsg({
        type: 'danger',
        text: err.response?.data?.error || 'Failed'
      });
    } finally {
      setConfirmingId(null);
    }
  };
  if (loading && !data) return <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '50vh'
  }}><div className="spinner-border" /></div>;
  const activePeriod = data?.period || period;
  const cards = [{
    label: t.totalSubscribers,
    value: data?.total_subscribers || 0,
    color: 'var(--accent)',
    bg: 'var(--accent-light)',
    icon: <FiUsers />
  }, {
    label: t.generatorOwners,
    value: data?.total_owners || 0,
    color: 'var(--success)',
    bg: 'var(--success-bg)',
    icon: <FiShield />
  }, {
    label: t.generators,
    value: data?.total_generators || 0,
    color: 'var(--warning)',
    bg: 'var(--warning-bg)',
    icon: <FiZap />
  }, {
    label: t.activeSubs,
    value: data?.active_subscriptions || 0,
    color: 'var(--info)',
    bg: 'var(--info-bg)',
    icon: <FiBarChart2 />
  }, {
    label: t.platformRevenue,
    value: `$${Number(data?.collected_revenue || 0).toFixed(2)}`,
    color: 'var(--success)',
    bg: 'var(--success-bg)',
    icon: <FiDollarSign />
  }, {
    label: t.pendingRevenue,
    value: `$${Number(data?.pending_revenue || 0).toFixed(2)}`,
    color: 'var(--warning)',
    bg: 'var(--warning-bg)',
    icon: <FiAlertCircle />
  }, {
    label: t.totalBills,
    value: data?.total_bills || 0,
    color: 'var(--text-sub)',
    bg: 'var(--bg3)',
    icon: <FiFileText />
  }, {
    label: t.unpaidBillsCount,
    value: data?.unpaid_bills || 0,
    color: 'var(--danger)',
    bg: 'var(--danger-bg)',
    icon: <FiAlertCircle />
  }];
  return <div>
      <div className="page-header">
        <h4 className="page-title">{t.adminDashboard}</h4>
        <div style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
          <AppSelect className="form-select form-select-sm" style={{
          width: 120,
          minWidth: 100
        }} value={period.month} onChange={e => setPeriod(p => ({
          ...p,
          month: parseInt(e.target.value, 10)
        }))}>
            {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </AppSelect>
          <input type="number" className="form-control form-control-sm" style={{
          width: 86,
          minWidth: 70
        }} min={2020} value={period.year} onChange={e => setPeriod(p => ({
          ...p,
          year: parseInt(e.target.value, 10) || p.year
        }))} />
        </div>
      </div>

      <div style={{
      fontSize: '0.76rem',
      color: 'var(--text-muted)',
      marginBottom: 14
    }}>
        {MONTHS[activePeriod.month]} {activePeriod.year}
      </div>

      {msg && <div className={`alert alert-${msg.type} alert-dismissible mb-3`}><UiText>{msg.text}</UiText><button className="btn-close" onClick={() => setMsg(null)}>✕</button></div>}

      <div className="row g-3 mb-4">
        {cards.map(s => <div className="col-6 col-sm-4 col-md-3" key={s.label}>
            <div className="stat-card">
              <div className="stat-icon" style={{
            background: s.bg,
            color: s.color
          }}>{s.icon}</div>
              <div className="stat-value" style={{
            color: s.color
          }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>)}
      </div>

      {/* Platform fee collections */}
      <div className="table-card mb-4">
        <div className="card-header-row">
          <span className="card-title">{t.monthlyPlatformFee || 'Monthly Platform Fee Collection'}</span>
        </div>

        {/* Mobile cards */}
        <div className="d-lg-none" style={{
        padding: '8px 10px'
      }}>
          {(data?.platform_fee_collections || []).map(row => <div className="data-card" key={row.id}>
              <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8
          }}>
                <div style={{
              minWidth: 0
            }}>
                  <div className="data-card-title">{row.owner_name}</div>
                  <div className="data-card-sub">{row.business_name || '—'}</div>
                </div>
                <span className={row.status === 'received' ? 'badge-paid' : 'badge-unpaid'}><UiText>{row.status}</UiText></span>
              </div>
              <div className="data-card-row">
                <span><UiText>Subscribers: </UiText><strong style={{
                color: 'var(--text)'
              }}>{row.subscriber_count || 0}</strong></span>
                <span style={{
              fontWeight: 700,
              color: 'var(--text)'
            }}>${Number(row.expected_amount_usd || 0).toFixed(4)}</span>
              </div>
              {row.status === 'pending' && <div style={{
            marginTop: 8
          }}>
                  <button className="btn btn-sm btn-success" disabled={confirmingId === row.id} onClick={() => handleConfirmCollection(row)}>
                    <FiCheck /> {confirmingId === row.id ? '...' : t.confirmCollection}
                  </button>
                </div>}
            </div>)}
          {!data?.platform_fee_collections?.length && <div style={{
          textAlign: 'center',
          color: 'var(--text-muted)',
          padding: '24px 0',
          fontSize: '0.85rem'
        }}><UiText>No collections for this period</UiText></div>}
        </div>

        {/* Desktop table */}
        <div className="d-none d-lg-block table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr><th><UiText>Owner</UiText></th><th><UiText>Subs</UiText></th><th><UiText>Fee/Sub</UiText></th><th><UiText>Expected</UiText></th><th>{t.status}</th><th><UiText>Received At</UiText></th><th><UiText>Confirmed By</UiText></th><th>{t.actions}</th></tr>
            </thead>
            <tbody>
              {(data?.platform_fee_collections || []).map(row => <tr key={row.id}>
                  <td>
                    <div style={{
                  fontWeight: 600
                }}>{row.owner_name}</div>
                    <div style={{
                  fontSize: '0.74rem',
                  color: 'var(--text-muted)'
                }}>{row.business_name || '—'}</div>
                  </td>
                  <td>{Number(row.subscriber_count || 0)}</td>
                  <td style={{
                fontSize: '0.82rem'
              }}>${Number(row.fee_per_subscriber_usd || 0).toFixed(4)}</td>
                  <td style={{
                fontWeight: 600
              }}>${Number(row.expected_amount_usd || 0).toFixed(4)}</td>
                  <td><span className={row.status === 'received' ? 'badge-paid' : 'badge-unpaid'}><UiText>{row.status}</UiText></span></td>
                  <td style={{
                fontSize: '0.8rem'
              }}>{row.received_at ? formatDateTimeUtcPlus2(row.received_at) : '—'}</td>
                  <td style={{
                fontSize: '0.8rem'
              }}>{row.confirmed_by_name || '—'}</td>
                  <td>
                    {row.status === 'pending' ? <button className="btn btn-sm btn-success" disabled={confirmingId === row.id} onClick={() => handleConfirmCollection(row)}><FiCheck /> {confirmingId === row.id ? '...' : t.confirmCollection}</button> : <span style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.78rem'
                }}>—</span>}
                  </td>
                </tr>)}
              {!data?.platform_fee_collections?.length && <tr><td colSpan={8} style={{
                textAlign: 'center',
                color: 'var(--text-muted)',
                padding: '24px',
                fontSize: '0.84rem'
              }}><UiText>No collections for this period</UiText></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent bills */}
      <div className="table-card">
        <div className="card-header-row"><span className="card-title">{t.recentBills}</span></div>

        {/* Mobile cards */}
        <div className="d-md-none" style={{
        padding: '8px 10px'
      }}>
          {(data?.recentBills || []).map(b => <div className="data-card" key={b.id}>
              <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8
          }}>
                <div>
                  <div className="data-card-title" style={{
                fontSize: '0.84rem'
              }}>{b.subscriber_name}</div>
                  <div className="data-card-sub">{b.generator_name} · {MONTHS[b.month]} {b.year}</div>
                </div>
                <span className={`badge-${b.status}`}>{t[b.status] || b.status}</span>
              </div>
              <div className="data-card-row">
                <span style={{
              fontWeight: 700,
              color: 'var(--text)'
            }}>{Number(b.amount || 0).toLocaleString()}<UiText> LBP</UiText></span>
                <span style={{
              fontSize: '0.76rem',
              color: 'var(--text-muted)'
            }}>${Number(b.platform_fee || 0).toFixed(4)}</span>
              </div>
            </div>)}
          {!data?.recentBills?.length && <div style={{
          textAlign: 'center',
          color: 'var(--text-muted)',
          padding: '24px 0',
          fontSize: '0.85rem'
        }}>{t.noData}</div>}
        </div>

        {/* Desktop table */}
        <div className="d-none d-md-block table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr><th>{t.subscriber}</th><th>{t.generator}</th><th>{t.period}</th><th>{t.amountTTC}</th><th>{t.platformFee || 'Platform Fee'}</th><th>{t.status}</th></tr>
            </thead>
            <tbody>
              {(data?.recentBills || []).map(b => <tr key={b.id}>
                  <td style={{
                fontWeight: 500
              }}>{b.subscriber_name}</td>
                  <td style={{
                fontSize: '0.84rem'
              }}>{b.generator_name}</td>
                  <td style={{
                fontSize: '0.84rem'
              }}>{MONTHS[b.month]} {b.year}</td>
                  <td style={{
                fontWeight: 600
              }}>{Number(b.amount || 0).toLocaleString()}<UiText> LBP</UiText></td>
                  <td style={{
                fontSize: '0.82rem'
              }}>${Number(b.platform_fee || 0).toFixed(4)}</td>
                  <td><span className={`badge-${b.status}`}>{t[b.status] || b.status}</span></td>
                </tr>)}
              {!data?.recentBills?.length && <tr><td colSpan={6} style={{
                textAlign: 'center',
                color: 'var(--text-muted)',
                padding: '24px',
                fontSize: '0.84rem'
              }}>{t.noData}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>;
}

// ── ADMIN USERS ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;
export function AdminUsers() {
  const {
    t
  } = useLang();
  const confirm = useConfirmDialog();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    page: 1
  });
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    full_name: '',
    username: '',
    phone: '',
    password: '',
    is_active: 1,
    business_name: '',
    role: ''
  });
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    phone: '',
    password: '',
    role: 'owner',
    business_name: ''
  });
  const [msg, setMsg] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: filters.page,
        limit: PAGE_SIZE
      };
      if (filters.search) params.search = filters.search;
      if (filters.role) params.role = filters.role;
      const res = await api.get('/admin/users', {
        params
      });
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch (err) {
      setMsg({
        type: 'danger',
        text: err.response?.data?.error || 'Failed'
      });
    } finally {
      setLoading(false);
    }
  }, [filters]);
  useEffect(() => {
    const timer = setTimeout(() => load(), 400);
    return () => clearTimeout(timer);
  }, [load]);
  const handleCreate = async e => {
    e.preventDefault();
    try {
      await api.post('/admin/users', form);
      setShowModal(false);
      setMsg({
        type: 'success',
        text: 'User created'
      });
      load();
    } catch (err) {
      setMsg({
        type: 'danger',
        text: err.response?.data?.error || 'Failed'
      });
    }
  };
  const openEdit = u => {
    if (u.role === 'admin') {
      setMsg({
        type: 'warning',
        text: 'Admin users cannot be edited here.'
      });
      return;
    }
    setEditForm({
      id: u.id,
      full_name: u.full_name || '',
      username: u.username || '',
      phone: u.phone || '',
      password: '',
      is_active: u.is_active ? 1 : 0,
      business_name: u.business_name || '',
      role: u.role || ''
    });
    setShowEditModal(true);
  };
  const handleSaveEdit = async e => {
    e.preventDefault();
    if (!editForm.id) return;
    setSavingEdit(true);
    try {
      const payload = {
        full_name: editForm.full_name.trim(),
        username: editForm.username.trim(),
        phone: editForm.phone.trim(),
        is_active: editForm.is_active ? 1 : 0
      };
      if (editForm.role === 'owner') payload.business_name = editForm.business_name?.trim() || '';
      if (String(editForm.password || '').trim()) payload.password = editForm.password;
      await api.put(`/admin/users/${editForm.id}`, payload);
      setShowEditModal(false);
      setMsg({
        type: 'success',
        text: 'User updated'
      });
      load();
    } catch (err) {
      setMsg({
        type: 'danger',
        text: err.response?.data?.error || 'Failed'
      });
    } finally {
      setSavingEdit(false);
    }
  };
  const handleToggle = async u => {
    if (u.role === 'admin') {
      setMsg({
        type: 'warning',
        text: 'Admin users cannot be edited here.'
      });
      return;
    }
    await api.put(`/admin/users/${u.id}`, {
      full_name: u.full_name,
      username: u.username,
      phone: u.phone,
      is_active: u.is_active ? 0 : 1,
      ...(u.role === 'owner' ? {
        business_name: u.business_name || ''
      } : {})
    });
    load();
  };
  const handleDelete = async id => {
    const user = users.find(u => u.id === id);
    if (user?.role === 'admin') {
      setMsg({
        type: 'warning',
        text: 'Admin users cannot be deactivated here.'
      });
      return;
    }
    const approved = await confirm({
      title: 'Deactivate User',
      message: 'Deactivate this user account?',
      confirmText: 'Deactivate',
      intent: 'danger'
    });
    if (!approved) return;
    await api.delete(`/admin/users/${id}`);
    load();
  };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <div>
      <div className="page-header">
        <h4 className="page-title">{t.users} <span style={{
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          fontWeight: 400
        }}>({total})</span></h4>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><FiPlus /><UiText> Create User</UiText></button>
      </div>

      {msg && <div className={`alert alert-${msg.type} alert-dismissible mb-3`}><UiText>{msg.text}</UiText><button className="btn-close" onClick={() => setMsg(null)}>✕</button></div>}

      <div className="table-card">
        <div className="card-header-row">
          <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
          flex: 1
        }}>
            <div className="search-wrap" style={{
            flex: 1,
            minWidth: 140,
            maxWidth: 240
          }}>
              <span className="search-icon"><FiSearch /></span>
              <input className="form-control form-control-sm" placeholder={t.search} value={filters.search} onChange={e => setFilters(f => ({
              ...f,
              search: e.target.value,
              page: 1
            }))} />
            </div>
            <AppSelect className="form-select form-select-sm" style={{
            width: 120,
            minWidth: 90
          }} value={filters.role} onChange={e => setFilters(f => ({
            ...f,
            role: e.target.value,
            page: 1
          }))}>
              <option value=""><UiText>All Roles</UiText></option>
              <option value="admin"><UiText>Admin</UiText></option>
              <option value="owner"><UiText>Owner</UiText></option>
              <option value="collector"><UiText>Collector</UiText></option>
              <option value="subscriber"><UiText>Subscriber</UiText></option>
            </AppSelect>
          </div>
        </div>

        {loading ? <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '40px 0'
      }}><div className="spinner-border" /></div> : <>
            {/* Mobile cards */}
            <div className="d-md-none" style={{
          padding: '8px 10px'
        }}>
              {users.map(u => <div className="data-card" key={u.id}>
                  <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 8
            }}>
                    <div style={{
                minWidth: 0
              }}>
                      <div className="data-card-title">{u.full_name}</div>
                      <div className="data-card-sub"><code>{u.username}</code> · {u.phone}</div>
                    </div>
                    <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 4,
                flexShrink: 0
              }}>
                      <span style={{
                  background: 'var(--accent-light)',
                  color: 'var(--accent)',
                  padding: '1px 7px',
                  borderRadius: 20,
                  fontSize: '0.67rem',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}><UiText>{u.role}</UiText></span>
                      <span className={u.is_active ? 'badge-active' : 'badge-inactive'}>{u.is_active ? t.active : t.inactive}</span>
                    </div>
                  </div>
                  <div style={{
              display: 'flex',
              gap: 5,
              marginTop: 8
            }}>
                    {u.role !== 'admin' ? <>
                        <button className="btn btn-sm btn-outline-primary" title={t.edit} onClick={() => openEdit(u)}><FiEdit2 /></button>
                        <button className={`btn btn-sm ${u.is_active ? 'btn-outline-warning' : 'btn-outline-success'}`} onClick={() => handleToggle(u)}>{u.is_active ? <FiToggleLeft /> : <FiToggleRight />}</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(u.id)}><UiText>x</UiText></button>
                      </> : <span style={{
                color: 'var(--text-muted)',
                fontSize: '0.78rem',
                padding: '4px 0'
              }}><UiText>Protected admin</UiText></span>}
                  </div>
                </div>)}
              {users.length === 0 && <div style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            padding: '36px 0',
            fontSize: '0.88rem'
          }}>{t.noData}</div>}
            </div>

            {/* Desktop table */}
            <div className="d-none d-md-block table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr><th>{t.name}</th><th><UiText>Username</UiText></th><th>{t.phone}</th><th><UiText>Role</UiText></th><th>{t.status}</th><th><UiText>Created</UiText></th><th>{t.actions}</th></tr>
                </thead>
                <tbody>
                  {users.map(u => <tr key={u.id}>
                      <td style={{
                  fontWeight: 500
                }}>{u.full_name}</td>
                      <td><code>{u.username}</code></td>
                      <td style={{
                  fontSize: '0.84rem'
                }}>{u.phone}</td>
                      <td><span style={{
                    background: 'var(--accent-light)',
                    color: 'var(--accent)',
                    padding: '2px 8px',
                    borderRadius: 20,
                    fontSize: '0.69rem',
                    fontWeight: 700,
                    textTransform: 'capitalize'
                  }}><UiText>{u.role}</UiText></span></td>
                      <td><span className={u.is_active ? 'badge-active' : 'badge-inactive'}>{u.is_active ? t.active : t.inactive}</span></td>
                      <td style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)'
                }}>{u.created_at?.slice(0, 10)}</td>
                      <td>
                        {u.role !== 'admin' ? <div style={{
                    display: 'flex',
                    gap: 4
                  }}>
                            <button className="btn btn-sm btn-outline-primary" title={t.edit} onClick={() => openEdit(u)}><FiEdit2 /></button>
                            <button className={`btn btn-sm ${u.is_active ? 'btn-outline-warning' : 'btn-outline-success'}`} title={u.is_active ? 'Disable' : 'Enable'} onClick={() => handleToggle(u)}>{u.is_active ? <FiToggleLeft /> : <FiToggleRight />}</button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(u.id)}><UiText>x</UiText></button>
                          </div> : <span style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.78rem'
                  }}><UiText>Protected admin</UiText></span>}
                      </td>
                    </tr>)}
                  {users.length === 0 && <tr><td colSpan={7} style={{
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  padding: '24px',
                  fontSize: '0.84rem'
                }}>{t.noData}</td></tr>}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && <div className="pagination-wrap">
                <span className="pagination-info"><UiText>Page </UiText>{filters.page}<UiText> of </UiText>{totalPages}</span>
                <div className="pagination-btns">
                  <button className="page-btn" disabled={filters.page <= 1} onClick={() => setFilters(f => ({
              ...f,
              page: f.page - 1
            }))}>‹</button>
                  {Array.from({
              length: Math.min(totalPages, 5)
            }, (_, i) => i + 1).map(p => <button key={p} className={`page-btn${filters.page === p ? ' active' : ''}`} onClick={() => setFilters(f => ({
              ...f,
              page: p
            }))}>{p}</button>)}
                  <button className="page-btn" disabled={filters.page >= totalPages} onClick={() => setFilters(f => ({
              ...f,
              page: f.page + 1
            }))}>›</button>
                </div>
              </div>}
          </>}
      </div>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton><Modal.Title><UiText>Create User</UiText></Modal.Title></Modal.Header>
        <Modal.Body>
          <form id="adminCreateForm" onSubmit={handleCreate}>
            <div className="row g-3">
              <div className="col-12 col-sm-6"><label className="form-label">{t.fullName} *</label><input className="form-control" value={form.full_name} onChange={e => setForm(f => ({
                ...f,
                full_name: e.target.value
              }))} required autoFocus /></div>
              <div className="col-12 col-sm-6"><label className="form-label"><UiText>Username *</UiText></label><input className="form-control" value={form.username} onChange={e => setForm(f => ({
                ...f,
                username: e.target.value
              }))} required /></div>
              <div className="col-12 col-sm-6"><label className="form-label">{t.phone}</label><input className="form-control" value={form.phone} onChange={e => setForm(f => ({
                ...f,
                phone: e.target.value
              }))} placeholder="+961XXXXXXXX" pattern="[+]961[0-9]{6,10}" title="Must start with +961" /></div>
              <div className="col-12 col-sm-6"><label className="form-label"><UiText>Role</UiText></label>
                <AppSelect className="form-select" value={form.role} onChange={e => setForm(f => ({
                ...f,
                role: e.target.value
              }))}>
                  <option value="owner"><UiText>Owner</UiText></option><option value="admin"><UiText>Admin</UiText></option>
                </AppSelect>
              </div>
              <div className="col-12"><label className="form-label">{t.password} * <span style={{
                  textTransform: 'none',
                  fontWeight: 400,
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)'
                }}><UiText>(8+ characters: uppercase, lowercase, number and symbol)</UiText></span></label><input type="password" className="form-control" value={form.password} onChange={e => setForm(f => ({
                ...f,
                password: e.target.value
              }))} required minLength={8} pattern={PASSWORD_PATTERN} maxLength={72} /></div>
              {form.role === 'owner' && <div className="col-12"><label className="form-label">{t.businessName}</label><input className="form-control" value={form.business_name} onChange={e => setForm(f => ({
                ...f,
                business_name: e.target.value
              }))} /></div>}
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t.cancel}</button>
          <button type="submit" form="adminCreateForm" className="btn btn-primary"><FiPlus /> {t.create}</button>
        </Modal.Footer>
      </Modal>

      <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
        <Modal.Header closeButton><Modal.Title>{t.edit}<UiText> User</UiText></Modal.Title></Modal.Header>
        <Modal.Body>
          <form id="adminEditForm" onSubmit={handleSaveEdit}>
            <div className="row g-3">
              <div className="col-12 col-sm-6">
                <label className="form-label">{t.fullName} *</label>
                <input className="form-control" value={editForm.full_name} onChange={e => setEditForm(f => ({
                ...f,
                full_name: e.target.value
              }))} required autoFocus />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label"><UiText>Username *</UiText></label>
                <input className="form-control" value={editForm.username} onChange={e => setEditForm(f => ({
                ...f,
                username: e.target.value
              }))} required minLength={3} pattern="[A-Za-z0-9_.-]+" />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">{t.phone}</label>
                <input className="form-control" value={editForm.phone} onChange={e => setEditForm(f => ({
                ...f,
                phone: e.target.value
              }))} placeholder="+961XXXXXXXX" pattern="[+]961[0-9]{6,10}" title="Must start with +961" />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">{t.password} <span style={{
                  textTransform: 'none',
                  fontWeight: 400,
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)'
                }}><UiText>(optional)</UiText></span></label>
                <input type="password" className="form-control" value={editForm.password} onChange={e => setEditForm(f => ({
                ...f,
                password: e.target.value
              }))} minLength={8} pattern={PASSWORD_PATTERN} placeholder="Leave blank to keep existing password" maxLength={72} />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">{t.status}</label>
                <AppSelect className="form-select" value={editForm.is_active ? 1 : 0} onChange={e => setEditForm(f => ({
                ...f,
                is_active: Number(e.target.value)
              }))}>
                  <option value={1}>{t.active}</option>
                  <option value={0}>{t.inactive}</option>
                </AppSelect>
              </div>
              {editForm.role === 'owner' && <div className="col-12">
                  <label className="form-label">{t.businessName}</label>
                  <input className="form-control" value={editForm.business_name} onChange={e => setEditForm(f => ({
                ...f,
                business_name: e.target.value
              }))} />
                </div>}
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>{t.cancel}</button>
          <button type="submit" form="adminEditForm" className="btn btn-primary" disabled={savingEdit}>
            {savingEdit ? <span className="spinner-border spinner-border-sm" /> : <><FiSave /> {t.save}</>}
          </button>
        </Modal.Footer>
      </Modal>
    </div>;
}

// ── ADMIN GENERATORS ───────────────────────────────────────────────────────────
export function AdminGenerators() {
  const {
    t
  } = useLang();
  const [generators, setGenerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    setLoading(true);
    api.get('/admin/generators').then(r => setGenerators(r.data || [])).catch(err => setMsg({
      type: 'danger',
      text: err.response?.data?.error || 'Failed'
    })).finally(() => setLoading(false));
  }, []);
  const filtered = generators.filter(g => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [g.name, g.location_name, g.main_meter_number, g.owner_name, g.owner_phone, g.business_name].some(v => String(v || '').toLowerCase().includes(q));
  });
  return <div>
      <div className="page-header">
        <h4 className="page-title">{t.generators} <span style={{
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          fontWeight: 400
        }}>({filtered.length})</span></h4>
        <div className="search-wrap" style={{
        width: '100%',
        maxWidth: 260
      }}>
          <span className="search-icon"><FiSearch /></span>
          <input className="form-control form-control-sm" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type} alert-dismissible mb-3`}><UiText>{msg.text}</UiText><button className="btn-close" onClick={() => setMsg(null)}>✕</button></div>}

      <div className="table-card">
        {loading ? <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '40px 0'
      }}><div className="spinner-border" /></div> : <>
            {/* Mobile cards */}
            <div className="d-md-none" style={{
          padding: '8px 10px'
        }}>
              {filtered.map(g => <div className="data-card" key={g.id}>
                  <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 8
            }}>
                    <div style={{
                minWidth: 0
              }}>
                      <div className="data-card-title">{g.name}</div>
                      <div className="data-card-sub">{g.owner_name} · {g.location_name || '—'}</div>
                    </div>
                    <span className={g.is_active ? 'badge-active' : 'badge-inactive'}>{g.is_active ? t.active : t.inactive}</span>
                  </div>
                  <div className="data-card-row">
                    <span>{t.plans}: {g.plan_count || 0} · {t.subscribers}: {g.subscriber_count || 0}</span>
                    {g.main_meter_number && <code style={{
                fontSize: '0.72rem'
              }}>{g.main_meter_number}</code>}
                  </div>
                </div>)}
              {!filtered.length && <div style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            padding: '36px 0',
            fontSize: '0.88rem'
          }}>{t.noData}</div>}
            </div>

            {/* Desktop table */}
            <div className="d-none d-md-block table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr><th>{t.generator}</th><th><UiText>Owner</UiText></th><th>{t.businessName}</th><th><UiText>Location</UiText></th><th><UiText>Meter #</UiText></th><th>{t.plans}</th><th>{t.subscribers}</th><th>{t.status}</th></tr>
                </thead>
                <tbody>
                  {filtered.map(g => <tr key={g.id}>
                      <td style={{
                  fontWeight: 600
                }}>{g.name}</td>
                      <td><div style={{
                    fontWeight: 500
                  }}>{g.owner_name}</div><div style={{
                    fontSize: '0.74rem',
                    color: 'var(--text-muted)'
                  }}>{g.owner_phone || '—'}</div></td>
                      <td style={{
                  fontSize: '0.84rem'
                }}>{g.business_name || '—'}</td>
                      <td style={{
                  fontSize: '0.84rem'
                }}>{g.location_name || '—'}</td>
                      <td><code>{g.main_meter_number || '—'}</code></td>
                      <td>{Number(g.plan_count || 0)}</td>
                      <td>{Number(g.subscriber_count || 0)}</td>
                      <td><span className={g.is_active ? 'badge-active' : 'badge-inactive'}>{g.is_active ? t.active : t.inactive}</span></td>
                    </tr>)}
                  {!filtered.length && <tr><td colSpan={8} style={{
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  padding: '24px',
                  fontSize: '0.84rem'
                }}>{t.noData}</td></tr>}
                </tbody>
              </table>
            </div>
          </>}
      </div>
    </div>;
}

// ── ADMIN SETTINGS ─────────────────────────────────────────────────────────────
export function AdminSettings() {
  const {
    t
  } = useLang();
  const {
    reloadUser
  } = useAuth();
  const [settings, setSettings] = useState([]);
  const [personal, setPersonal] = useState({
    full_name: '',
    username: '',
    phone: '',
    password: ''
  });
  const [loading, setLoading] = useState(true);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [editing, setEditing] = useState({});
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let mounted = true;
    Promise.all([api.get('/admin/settings'), api.get('/auth/me')]).then(([settingsRes, meRes]) => {
      if (!mounted) return;
      setSettings(settingsRes.data || []);
      const me = meRes.data || {};
      setPersonal({
        full_name: me.full_name || '',
        username: me.username || '',
        phone: me.phone || '',
        password: ''
      });
      setLoading(false);
    }).catch(() => {
      if (!mounted) return;
      setMsg({
        type: 'danger',
        text: 'Failed to load settings'
      });
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);
  const handleSavePersonal = async e => {
    e.preventDefault();
    if (savingPersonal) return;
    setSavingPersonal(true);
    try {
      await api.put('/auth/profile', personal);
      setPersonal(p => ({
        ...p,
        password: ''
      }));
      await reloadUser();
      setMsg({
        type: 'success',
        text: 'Personal info updated'
      });
    } catch (err) {
      setMsg({
        type: 'danger',
        text: err.response?.data?.error || 'Failed'
      });
    } finally {
      setSavingPersonal(false);
    }
  };
  const handleSave = async key => {
    try {
      await api.put(`/admin/settings/${key}`, {
        value: editing[key]
      });
      setSettings(s => s.map(x => x.setting_key === key ? {
        ...x,
        setting_value: editing[key]
      } : x));
      if (key === 'platform_name') {
        await reloadUser();
      }
      setMsg({
        type: 'success',
        text: `"${key}" updated`
      });
    } catch (err) {
      setMsg({
        type: 'danger',
        text: err.response?.data?.error || 'Failed'
      });
    }
  };
  if (loading) return <div style={{
    display: 'flex',
    justifyContent: 'center',
    padding: '40px 0'
  }}><div className="spinner-border" /></div>;
  return <div>
      <div className="page-header">
        <h4 className="page-title"><FiSettings style={{
          marginRight: 7,
          verticalAlign: 'middle'
        }} />{t.settings}</h4>
      </div>
      {msg && <div className={`alert alert-${msg.type} alert-dismissible mb-3`}><UiText>{msg.text}</UiText><button className="btn-close" onClick={() => setMsg(null)}>✕</button></div>}
      <div className="table-card mb-3">
        <div className="card-header-row">
          <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
            <span style={{
            color: 'var(--accent)'
          }}><FiUser /></span>
            <span className="card-title">{t.personalInfo}</span>
          </div>
          <button type="submit" form="adminPersonalInfoForm" className="btn btn-sm btn-outline-primary" disabled={savingPersonal} style={{
          minWidth: 120,
          justifyContent: 'center'
        }}>
            {savingPersonal ? <><span className="spinner-border spinner-border-sm" style={{
              marginRight: 8
            }} /><UiText>Saving...</UiText></> : <><FiSave style={{
              marginRight: 6
            }} />{t.saveChanges || t.save}</>}
          </button>
        </div>
        <div style={{
        padding: '16px'
      }}>
          <form id="adminPersonalInfoForm" onSubmit={handleSavePersonal}>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">{t.fullName} *</label>
                <input className="form-control" value={personal.full_name} onChange={e => setPersonal(p => ({
                ...p,
                full_name: e.target.value
              }))} required autoFocus />
              </div>
              <div className="col-md-4">
                <label className="form-label">{t.username} *</label>
                <input className="form-control" value={personal.username} onChange={e => setPersonal(p => ({
                ...p,
                username: e.target.value
              }))} required minLength={3} pattern="[A-Za-z0-9_.-]+" />
              </div>
              <div className="col-md-4">
                <label className="form-label">{t.phone}</label>
                <input className="form-control" value={personal.phone} onChange={e => setPersonal(p => ({
                ...p,
                phone: e.target.value
              }))} placeholder="+961XXXXXXXX" pattern="[+]961[0-9]{6,10}" title="Must start with +961" />
              </div>
              <div className="col-md-4">
                <label className="form-label">{t.password}</label>
                <input type="password" className="form-control" value={personal.password} onChange={e => setPersonal(p => ({
                ...p,
                password: e.target.value
              }))} minLength={8} pattern={PASSWORD_PATTERN} title="At least 8 characters: uppercase, lowercase, number and symbol" placeholder="Use Password & Security page" disabled maxLength={72} />
              </div>
            </div>
          </form>
        </div>
      </div>
      <div className="table-card">
        {/* Mobile: stacked inputs */}
        <div className="d-md-none" style={{
        padding: '8px 10px'
      }}>
          {settings.map(s => <div className="data-card" key={s.setting_key}>
              <div className="data-card-title"><code>{s.setting_key}</code></div>
              {s.description && <div className="data-card-sub">{s.description}</div>}
              <div style={{
            display: 'flex',
            gap: 6,
            marginTop: 8,
            alignItems: 'center'
          }}>
                <input className="form-control form-control-sm" style={{
              flex: 1
            }} value={editing[s.setting_key] !== undefined ? editing[s.setting_key] : s.setting_value} onChange={e => setEditing(ed => ({
              ...ed,
              [s.setting_key]: e.target.value
            }))} />
                <button className="btn btn-sm btn-primary" aria-label={`${t.saveSetting}: ${s.setting_key}`} onClick={() => handleSave(s.setting_key)}><FiSave /></button>
              </div>
            </div>)}
        </div>
        {/* Desktop table */}
        <div className="d-none d-md-block table-responsive">
          <table className="table mb-0">
            <thead><tr><th><UiText>Key</UiText></th><th><UiText>Value</UiText></th><th><UiText>Description</UiText></th><th></th></tr></thead>
            <tbody>
              {settings.map(s => <tr key={s.setting_key}>
                  <td><code>{s.setting_key}</code></td>
                  <td style={{
                minWidth: 180
              }}><input className="form-control form-control-sm" value={editing[s.setting_key] !== undefined ? editing[s.setting_key] : s.setting_value} onChange={e => setEditing(ed => ({
                  ...ed,
                  [s.setting_key]: e.target.value
                }))} /></td>
                  <td style={{
                fontSize: '0.82rem',
                color: 'var(--text-muted)'
              }}>{s.description}</td>
                  <td><button className="btn btn-sm btn-primary" aria-label={`${t.saveSetting}: ${s.setting_key}`} onClick={() => handleSave(s.setting_key)}><FiSave /></button></td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>;
}
