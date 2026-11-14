import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiSearch, FiFileText, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import api from '../../services/api';
import { useLang } from '../../contexts/LangContext';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';
import { MONTHS_EN, MONTHS_AR } from '../../i18n';
import { printInvoiceDirect } from '../Shared/InvoicePrint';
import AppSelect from '../Shared/AppSelect';

const PAGE_SIZE = 20;

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

function resolveBillUsd(bill, fallbackRate = 89700) {
  const usd = Number(bill?.total_usd);
  const lbp = Number(bill?.total_ttc_lbp || 0);
  if (bill?.total_usd !== null && bill?.total_usd !== undefined && bill?.total_usd !== '' && Number.isFinite(usd) && usd >= 0 && (usd > 0 || lbp <= 0)) {
    return usd;
  }
  return toUsd(lbp, bill?.usd_lbp_rate || fallbackRate);
}

function fmtBillDual(bill, fallbackRate = 89700) {
  return `${fmtUsd(resolveBillUsd(bill, fallbackRate))} (${Number(bill?.total_ttc_lbp || 0).toLocaleString()} LBP)`;
}

export default function OwnerAccountStatement() {
  const { t, lang } = useLang();
  const confirm = useConfirmDialog();
  const MONTHS = lang === 'ar' ? MONTHS_AR : MONTHS_EN;
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [bills, setBills] = useState([]);
  const [page, setPage] = useState(1);
  const [combiningKey, setCombiningKey] = useState('');
  const [showCombineModal, setShowCombineModal] = useState(false);
  const [combineTarget, setCombineTarget] = useState(null);
  const [selectedCombineIds, setSelectedCombineIds] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.status) params.status = filters.status;
      const res = await api.get('/owner/bills', { params });
      setBills(res.data || []);
      setMsg(null);
    } catch (err) {
      setMsg({ type: 'danger', text: err.response?.data?.error || 'Failed to load account statement' });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    setPage(1);
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  const fallbackUsdRate = useMemo(() => {
    const match = bills.find((b) => Number(b?.usd_lbp_rate) > 0);
    return Number(match?.usd_lbp_rate || 89700) || 89700;
  }, [bills]);

  const summary = useMemo(() => {
    const paid = bills.filter((b) => b.status === 'paid');
    const unpaid = bills.filter((b) => b.status === 'unpaid');
    return {
      total: bills.length,
      paidCount: paid.length,
      unpaidCount: unpaid.length,
      paidAmountLbp: paid.reduce((sum, b) => sum + Number(b.total_ttc_lbp || 0), 0),
      paidAmountUsd: paid.reduce((sum, b) => sum + resolveBillUsd(b, fallbackUsdRate), 0),
      unpaidAmountLbp: unpaid.reduce((sum, b) => sum + Number(b.total_ttc_lbp || 0), 0),
      unpaidAmountUsd: unpaid.reduce((sum, b) => sum + resolveBillUsd(b, fallbackUsdRate), 0),
    };
  }, [bills, fallbackUsdRate]);

  const unpaidPeriods = useMemo(
    () => bills
      .filter((b) => b.status === 'unpaid')
      .map((b) => ({
        id: b.id,
        subscriber_name: b.subscriber_name,
        month: b.month,
        year: b.year,
      }))
      .sort((a, b) => (b.year - a.year) || (b.month - a.month)),
    [bills]
  );

  const combinableGroups = useMemo(() => {
    const groups = new Map();
    bills.forEach((bill) => {
      if (bill.status !== 'unpaid') return;
      if (Number(bill.is_combined_invoice || 0) === 1) return;
      const subscriptionId = Number(bill.subscription_id || 0);
      const key = subscriptionId > 0 ? `sub-${subscriptionId}` : `name-${String(bill.subscriber_name || '').toLowerCase()}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          subscription_id: subscriptionId,
          subscriber_name: bill.subscriber_name || '-',
          entries: [],
          totalLbp: 0,
          totalUsd: 0,
        });
      }
      const group = groups.get(key);
      const monthNumber = Number(bill.month || 0);
      group.entries.push({
        id: Number(bill.id),
        month: monthNumber,
        year: Number(bill.year || 0),
        label: `${MONTHS[monthNumber] || monthNumber} ${bill.year}`,
        totalLbp: Number(bill.total_ttc_lbp || 0),
        totalUsd: resolveBillUsd(bill, fallbackUsdRate),
      });
      group.totalLbp += Number(bill.total_ttc_lbp || 0);
      group.totalUsd += resolveBillUsd(bill, fallbackUsdRate);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        entries: Array.from(new Map(group.entries.map((entry) => [entry.id, entry])).values())
          .filter((entry) => Number.isInteger(entry.id) && entry.id > 0)
          .sort((a, b) => (a.year - b.year) || (a.month - b.month)),
      }))
      .filter((group) => group.entries.length > 1)
      .sort((a, b) => (b.entries.length - a.entries.length) || (b.totalLbp - a.totalLbp));
  }, [bills, MONTHS, fallbackUsdRate]);

  const openCombineModal = (group) => {
    const initialIds = Array.isArray(group?.entries)
      ? group.entries.map((entry) => Number(entry.id)).filter((id) => Number.isInteger(id) && id > 0)
      : [];
    setCombineTarget(group || null);
    setSelectedCombineIds(initialIds);
    setShowCombineModal(true);
  };

  const handleToggleCombineId = (billId) => {
    const id = Number(billId);
    if (!Number.isInteger(id) || id <= 0) return;
    setSelectedCombineIds((prev) => (
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    ));
  };

  const handleCombineConfirm = async () => {
    const group = combineTarget;
    if (!group?.key) return;
    const ids = Array.from(new Set(
      selectedCombineIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    ));
    const count = Number(ids.length || 0);
    if (count < 2) return;

    const approved = await confirm({
      title: 'Combine Unpaid Bills',
      message: `Combine ${count} unpaid bills for "${group.subscriber_name}" into one bill?`,
      confirmText: t.combineBillsAction,
      intent: 'warning',
    });
    if (!approved) return;

    const autoPrintWindow = window.open('', '_blank');
    if (autoPrintWindow) {
      autoPrintWindow.document.open();
      autoPrintWindow.document.write('<html><head><title>Preparing invoice...</title></head><body style="font-family:Arial,sans-serif;padding:20px;">Preparing invoice...</body></html>');
      autoPrintWindow.document.close();
    }

    setCombiningKey(group.key);
    try {
      const res = await api.post('/owner/bills/combine', { bill_ids: ids });
      const combinedBillId = Number(res?.data?.bill?.id || 0);
      if (!Number.isInteger(combinedBillId) || combinedBillId <= 0) {
        throw new Error('Combined invoice was created but could not be identified');
      }

      await api.put(`/owner/bills/${combinedBillId}/pay`);

      let printed = false;
      try {
        const billRes = await api.get(`/owner/bills/${combinedBillId}`);
        await printInvoiceDirect({
          bill: billRes.data?.bill,
          owner: billRes.data?.owner,
          targetWindow: autoPrintWindow || null,
        });
        printed = true;
      } catch (_) {
        printed = false;
      }

      if (printed) {
        setMsg({ type: 'success', text: 'Bills combined, payment processed, and invoice opened for printing.' });
      } else if (!autoPrintWindow) {
        setMsg({ type: 'warning', text: 'Bills combined and paid. Please allow pop-ups to print automatically.' });
      } else {
        setMsg({ type: 'warning', text: 'Bills combined and paid, but invoice could not be loaded for printing.' });
      }

      setShowCombineModal(false);
      setCombineTarget(null);
      setSelectedCombineIds([]);
      await load();
    } catch (err) {
      try { if (autoPrintWindow) autoPrintWindow.close(); } catch (_) {}
      setMsg({ type: 'danger', text: err.response?.data?.error || 'Failed to combine bills' });
    } finally {
      setCombiningKey('');
    }
  };

  const totalPages = Math.max(1, Math.ceil(bills.length / PAGE_SIZE));
  const pagedBills = bills.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <h4 className="page-title">{t.accountStatement}</h4>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type} alert-dismissible mb-3`}>
          {msg.text}
          <button className="btn-close" onClick={() => setMsg(null)}>x</button>
        </div>
      )}

      <div className="row row-cols-2 row-cols-md-3 row-cols-xl-5 g-3 mb-3">
        <div className="col">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}><FiFileText /></div>
            <div className="stat-value" style={{ color: 'var(--accent)' }}>{summary.total}</div>
            <div className="stat-label">{t.totalBills}</div>
          </div>
        </div>
        <div className="col">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><FiCheckCircle /></div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{summary.paidCount}</div>
            <div className="stat-label">{t.paid}</div>
          </div>
        </div>
        <div className="col">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}><FiAlertCircle /></div>
            <div className="stat-value" style={{ color: 'var(--warning)' }}>{summary.unpaidCount}</div>
            <div className="stat-label">{t.unpaid}</div>
          </div>
        </div>
        <div className="col">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><FiCheckCircle /></div>
            <div className="stat-value" style={{ color: 'var(--success)', fontSize: '1rem' }}>
              {`${fmtUsd(summary.paidAmountUsd)} (${Number(summary.paidAmountLbp || 0).toLocaleString()} LBP)`}
            </div>
            <div className="stat-label">{t.paidForPeriod}</div>
          </div>
        </div>
        <div className="col">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}><FiAlertCircle /></div>
            <div className="stat-value" style={{ color: 'var(--danger)', fontSize: '1rem' }}>
              {`${fmtUsd(summary.unpaidAmountUsd)} (${Number(summary.unpaidAmountLbp || 0).toLocaleString()} LBP)`}
            </div>
            <div className="stat-label">{t.unpaidForPeriod}</div>
          </div>
        </div>
      </div>

      <div className="table-card mb-3">
        <div className="card-header-row">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-wrap">
              <span className="search-icon"><FiSearch /></span>
              <input
                className="form-control form-control-sm"
                style={{ width: 280 }}
                placeholder={t.searchSubscriber}
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
            <AppSelect
              className="form-select form-select-sm"
              style={{ width: 140 }}
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">{t.allStatuses}</option>
              <option value="paid">{t.paid}</option>
              <option value="unpaid">{t.unpaid}</option>
              <option value="waived">{t.waived}</option>
            </AppSelect>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{bills.length} {t.bills?.toLowerCase?.() || 'bills'}</span>
        </div>
      </div>

      <div className="table-card mb-3">
        <div className="card-header-row">
          <span className="card-title">{t.unpaidPeriods}</span>
        </div>
        <div style={{ padding: '10px 14px' }}>
          {unpaidPeriods.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {unpaidPeriods.map((item) => (
                <span key={item.id} className="badge-unpaid">
                  {`${item.subscriber_name} - ${MONTHS[item.month]} ${item.year}`}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t.noData}</div>
          )}
        </div>
      </div>

      {combinableGroups.length > 0 && (
        <div className="table-card mb-3">
          <div className="card-header-row">
            <span className="card-title">{t.combineUnpaidBills}</span>
          </div>
          <div style={{ padding: '10px 14px', display: 'grid', gap: 10 }}>
            {combinableGroups.map((group) => (
              <div
                key={group.key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  background: 'var(--bg3)',
                }}
              >
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                    {group.subscriber_name} - {group.entries.length} {t.bills?.toLowerCase?.() || 'bills'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {`${fmtUsd(group.totalUsd)} (${Number(group.totalLbp).toLocaleString()} LBP)`}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)', marginTop: 2 }}>
                    {group.entries.map((entry) => entry.label).join(', ')}
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-outline-warning"
                  onClick={() => openCombineModal(group)}
                  disabled={combiningKey === group.key}
                >
                  {combiningKey === group.key
                    ? (t.loading)
                    : (t.combineBillsAction || `Combine ${group.entries.length}`)}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="table-card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <div className="spinner-border" />
          </div>
        ) : (
          <>
            <div className="d-md-none" style={{ padding: '10px 12px' }}>
              {pagedBills.map((b) => (
                <div className="data-card" key={b.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{b.subscriber_name}</div>
                      <code style={{ fontSize: '0.74rem' }}>{b.invoice_number}</code>
                    </div>
                    <span className={`badge-${b.status}`}>{t[b.status] || b.status}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                    {`${MONTHS[b.month]} ${b.year}`}
                  </div>
                  <div className="data-card-row">
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmtBillDual(b, fallbackUsdRate)}</span>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{b.subscriber_phone || '-'}</span>
                  </div>
                </div>
              ))}
              {!bills.length && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '36px 0', fontSize: '0.88rem' }}>
                  {t.noData}
                </div>
              )}
            </div>

            <div className="d-none d-md-block table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>{t.subscriber}</th>
                    <th>{t.invoice}</th>
                    <th>{t.period}</th>
                    <th>{t.totalTTC}</th>
                    <th>{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedBills.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{b.subscriber_name}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{b.subscriber_phone || '-'}</div>
                      </td>
                      <td><code>{b.invoice_number}</code></td>
                      <td style={{ fontSize: '0.84rem' }}>{MONTHS[b.month]} {b.year}</td>
                      <td style={{ fontWeight: 700 }}>{fmtBillDual(b, fallbackUsdRate)}</td>
                      <td><span className={`badge-${b.status}`}>{t[b.status] || b.status}</span></td>
                    </tr>
                  ))}
                  {!bills.length && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4" style={{ fontSize: '0.84rem' }}>{t.noData}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination-wrap">
                <span className="pagination-info">Page {page} of {totalPages}</span>
                <div className="pagination-btns">
                  <button className="page-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{'<'}</button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                    <button key={p} className={`page-btn${page === p ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                  ))}
                  <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{'>'}</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        show={showCombineModal}
        onHide={() => {
          setShowCombineModal(false);
          setCombineTarget(null);
          setSelectedCombineIds([]);
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{t.combineUnpaidBills}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div style={{ fontSize: '0.9rem', color: 'var(--text)', fontWeight: 700, marginBottom: 8 }}>
            {combineTarget?.subscriber_name || '-'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>
            Select the months to combine into one invoice.
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {(combineTarget?.entries || []).map((entry) => (
              <label
                key={entry.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 10px',
                  background: 'var(--bg3)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={selectedCombineIds.includes(entry.id)}
                    onChange={() => handleToggleCombineId(entry.id)}
                  />
                  <span>{entry.label}</span>
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                  {`${fmtUsd(entry.totalUsd)} (${Number(entry.totalLbp || 0).toLocaleString()} LBP)`}
                </span>
              </label>
            ))}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setShowCombineModal(false);
              setCombineTarget(null);
              setSelectedCombineIds([]);
            }}
          >
            {t.cancel}
          </button>
          <button
            className="btn btn-warning"
            onClick={handleCombineConfirm}
            disabled={!combineTarget || selectedCombineIds.length < 2 || combiningKey === combineTarget.key}
          >
            {combiningKey === combineTarget?.key
              ? (t.loading)
              : (t.combineBillsAction)}
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
