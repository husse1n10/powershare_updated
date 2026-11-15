import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiPrinter, FiSearch, FiCheckCircle, FiDollarSign,
  FiArrowUpRight, FiClock, FiFileText, FiSend,
} from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import api from '../../services/api';
import { useLang } from '../../contexts/LangContext';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';
import { MONTHS_EN, MONTHS_AR } from '../../i18n';
import { formatDateTimeUtcPlus2, getCurrentMonthYearUtcPlus2 } from '../../utils/timezone';
import { printInvoiceDirect } from '../Shared/InvoicePrint';
import AppSelect from '../Shared/AppSelect';

const EMPTY_WALLET = {
  collected_lbp: 0,
  transferred_lbp: 0,
  balance_lbp: 0,
  pending_lbp: 0,
  available_lbp: 0,
  pending_count: 0,
};

function fmtLbp(n) {
  return `${Number(n || 0).toLocaleString()} LBP`;
}

function fmtUsd(n) {
  return `$${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toUsd(lbp, rate) {
  const safeRate = Number(rate) > 0 ? Number(rate) : 89700;
  return Number(lbp || 0) / safeRate;
}

function resolveBillDueLbp(bill) {
  const amountDue = Number(bill?.remaining_balance_lbp ?? bill?.amount_due_lbp);
  return Number.isFinite(amountDue) ? amountDue : Number(bill?.total_ttc_lbp || 0);
}

function resolveBillDueUsd(bill) {
  const amountDueUsd = Number(bill?.remaining_balance_usd ?? bill?.amount_due_usd);
  if (Number.isFinite(amountDueUsd)) return amountDueUsd;
  return toUsd(resolveBillDueLbp(bill), bill?.usd_lbp_rate);
}

const PAGE_SIZE = 20;

export default function CollectorBills() {
  const { t, lang } = useLang();
  const confirm = useConfirmDialog();
  const MONTHS = lang === 'ar' ? MONTHS_AR : MONTHS_EN;
  const now = getCurrentMonthYearUtcPlus2();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [activeSection, setActiveSection] = useState('bills');
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    month: now.month,
    year: now.year,
  });
  const [bills, setBills] = useState([]);
  const [allUnpaidBills, setAllUnpaidBills] = useState([]);
  const [wallet, setWallet] = useState(EMPTY_WALLET);
  const [settlements, setSettlements] = useState([]);
  const [requestForm, setRequestForm] = useState({ amount_lbp:'', notes:'' });
  const [requesting, setRequesting] = useState(false);
  const [page, setPage] = useState(1);
  const [combiningKey, setCombiningKey] = useState('');
  const [showCombineModal, setShowCombineModal] = useState(false);
  const [combineTarget, setCombineTarget] = useState(null);
  const [selectedCombineIds, setSelectedCombineIds] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentBill, setSelectedPaymentBill] = useState(null);
  const [paymentAmountUsd, setPaymentAmountUsd] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.month) params.month = filters.month;
      if (filters.year) params.year = filters.year;

      const unpaidParams = {};
      if (filters.search) unpaidParams.search = filters.search;

      const [billsRes, unpaidBillsRes, walletRes, settlementsRes] = await Promise.all([
        api.get('/collector/bills', { params }),
        api.get('/collector/bills', { params: unpaidParams }),
        api.get('/collector/wallet'),
        api.get('/collector/settlements'),
      ]);
      setBills(billsRes.data || []);
      setAllUnpaidBills(unpaidBillsRes.data || []);
      setWallet(walletRes.data || EMPTY_WALLET);
      setSettlements(settlementsRes.data || []);
      setMsg(null);
    } catch (err) {
      setMsg({ type:'danger', text: err.response?.data?.error||'Failed to load collector data' });
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => {
    setPage(1);
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  const handlePrintInvoice = async (billId, silent = false, existingWindow = null) => {
    const printWindow = existingWindow || window.open('', '_blank');
    if (!printWindow) {
      if (!silent) setMsg({ type:'danger', text:'Please allow pop-ups to print invoice.' });
      return false;
    }

    printWindow.document.open();
    printWindow.document.write('<html><head><title>Preparing invoice...</title></head><body style="font-family:Arial,sans-serif;padding:20px;">Preparing invoice...</body></html>');
    printWindow.document.close();

    try {
      const res = await api.get(`/collector/bills/${billId}`);
      await printInvoiceDirect({
        bill: res.data?.bill,
        owner: res.data?.owner,
        targetWindow: printWindow,
      });
      return true;
    } catch (err) {
      try { printWindow.close(); } catch {}
      if (!silent) setMsg({ type:'danger', text: err.response?.data?.error||'Could not load invoice' });
      return false;
    }
  };

  const openPaymentModal = (bill) => {
    setSelectedPaymentBill(bill);
    setPaymentAmountUsd(resolveBillDueUsd(bill).toFixed(2));
    setShowPaymentModal(true);
  };

  const handleMarkPaid = async (e) => {
    e.preventDefault();
    if (!selectedPaymentBill?.id) return;
    const autoPrintWindow = window.open('', '_blank');
    if (autoPrintWindow) {
      autoPrintWindow.document.open();
      autoPrintWindow.document.write('<html><head><title>Preparing invoice...</title></head><body style="font-family:Arial,sans-serif;padding:20px;">Preparing invoice...</body></html>');
      autoPrintWindow.document.close();
    }

    setSavingPayment(true);
    try {
      await api.put(`/collector/bills/${selectedPaymentBill.id}/pay`, {
        amount_received_usd: paymentAmountUsd,
      });
      setShowPaymentModal(false);
      const printed = autoPrintWindow
        ? await handlePrintInvoice(selectedPaymentBill.id, true, autoPrintWindow)
        : false;
      if (printed) {
        setMsg({ type:'success', text:t.billMarkedPaidAndOpenedPrint || 'Bill marked as paid and opened for printing.' });
      } else if (!autoPrintWindow) {
        setMsg({ type:'warning', text:t.billMarkedPaidAllowPopups || 'Bill marked as paid. Please allow pop-ups to print invoice automatically.' });
      } else {
        setMsg({ type:'warning', text:t.billMarkedPaidInvoiceLoadFailed || 'Bill marked as paid, but invoice could not be loaded for printing.' });
      }
      load();
    } catch (err) {
      try { if (autoPrintWindow) autoPrintWindow.close(); } catch {}
      setMsg({ type:'danger', text: err.response?.data?.error||'Failed to mark bill as paid' });
    } finally {
      setSavingPayment(false);
    }
  };

  const handleFillFullPayment = () => {
    const available = Number(wallet.available_lbp || 0);
    setRequestForm(f => ({ ...f, amount_lbp: available > 0 ? available.toFixed(2) : '' }));
  };

  const handleRequestSettlement = async (e) => {
    e.preventDefault();
    setRequesting(true);
    setMsg(null);
    try {
      await api.post('/collector/settlements/request', {
        amount_lbp: requestForm.amount_lbp,
        notes: requestForm.notes,
      });
      setRequestForm({ amount_lbp:'', notes:'' });
      setMsg({ type:'success', text:'Settlement request sent to owner for confirmation.' });
      setActiveSection('history');
      load();
    } catch (err) {
      setMsg({ type:'danger', text: err.response?.data?.error||'Failed to request settlement' });
    } finally { setRequesting(false); }
  };

  const unpaidPeriods = useMemo(
    () => allUnpaidBills
      .filter((b) => ['unpaid','partially_paid'].includes(b.status))
      .map((b) => ({
        id: Number(b.id),
        subscriber_name: b.subscriber_name || '-',
        month: Number(b.month || 0),
        year: Number(b.year || 0),
      }))
      .sort((a, b) => (b.year - a.year) || (b.month - a.month)),
    [allUnpaidBills]
  );

  const combinableGroups = useMemo(() => {
    const groups = new Map();
    allUnpaidBills.forEach((bill) => {
      if (bill.status !== 'unpaid') return;
      if (Number(bill.is_combined_invoice || 0) === 1) return;
      if (Number(bill.combined_parent_bill_id || 0) > 0) return;

      const subscriptionId = Number(bill.subscription_id || 0);
      const key = subscriptionId > 0
        ? `sub-${subscriptionId}`
        : `name-${String(bill.subscriber_name || '').toLowerCase()}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          subscriber_name: bill.subscriber_name || '-',
          entries: [],
        });
      }

      const monthNumber = Number(bill.month || 0);
      groups.get(key).entries.push({
        id: Number(bill.id),
        month: monthNumber,
        year: Number(bill.year || 0),
        label: `${MONTHS[monthNumber] || monthNumber} ${bill.year}`,
      });
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        entries: Array.from(new Map(group.entries.map((entry) => [entry.id, entry])).values())
          .filter((entry) => Number.isInteger(entry.id) && entry.id > 0)
          .sort((a, b) => (a.year - b.year) || (a.month - b.month)),
      }))
      .filter((group) => group.entries.length > 1)
      .sort((a, b) => b.entries.length - a.entries.length);
  }, [allUnpaidBills, MONTHS]);

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
    if (ids.length < 2) return;

    const approved = await confirm({
      title: 'Combine Unpaid Bills',
      message: `Combine ${ids.length} unpaid bills for "${group.subscriber_name}" into one bill?`,
      confirmText: 'Combine',
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
      const res = await api.post('/collector/bills/combine', { bill_ids: ids });
      const combinedBillId = Number(res?.data?.bill?.id || 0);
      if (!Number.isInteger(combinedBillId) || combinedBillId <= 0) {
        throw new Error('Combined invoice was created but could not be identified');
      }

      await api.put(`/collector/bills/${combinedBillId}/pay`);
      const printed = autoPrintWindow
        ? await handlePrintInvoice(combinedBillId, true, autoPrintWindow)
        : false;

      if (printed) {
        setMsg({ type:'success', text:'Bills combined, payment processed, and invoice opened for printing.' });
      } else if (!autoPrintWindow) {
        setMsg({ type:'warning', text:'Bills combined and paid. Please allow pop-ups to print automatically.' });
      } else {
        setMsg({ type:'warning', text:'Bills combined and paid, but invoice could not be loaded for printing.' });
      }

      setShowCombineModal(false);
      setCombineTarget(null);
      setSelectedCombineIds([]);
      await load();
    } catch (err) {
      try { if (autoPrintWindow) autoPrintWindow.close(); } catch {}
      setMsg({ type:'danger', text: err.response?.data?.error || err.message || 'Failed to combine bills' });
    } finally {
      setCombiningKey('');
    }
  };

  const totalPages = Math.max(1, Math.ceil(bills.length / PAGE_SIZE));
  const pagedBills = bills.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const walletCards = [
    { label: t.collected,    value: fmtLbp(wallet.collected_lbp),   color:'var(--success)',  bg:'var(--success-bg)',  icon:<FiDollarSign /> },
    { label: t.transferred,  value: fmtLbp(wallet.transferred_lbp), color:'var(--info)',     bg:'var(--info-bg)',     icon:<FiArrowUpRight /> },
    { label: t.pending,      value: fmtLbp(wallet.pending_lbp),     color:'var(--warning)',  bg:'var(--warning-bg)', icon:<FiClock /> },
    { label: t.available,    value: fmtLbp(wallet.available_lbp),   color:'var(--accent)',   bg:'var(--accent-light)',icon:<FiCheckCircle /> },
  ];

  const tabs = [
    { key:'bills',      label:`${t.bills} (${bills.length})`,             icon:<FiFileText /> },
    { key:'settlement', label: t.recordSettlement,                         icon:<FiSend /> },
    { key:'history',    label:`${t.settlements} (${settlements.length})`,  icon:<FiClock /> },
  ];

  return (
    <div>
      <div className="page-header">
        <h4 className="page-title">{t.billsWallet}</h4>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type} alert-dismissible mb-3`}>
          {msg.text}<button className="btn-close" onClick={()=>setMsg(null)}>✕</button>
        </div>
      )}

      {/* Wallet stat cards */}
      <div className="row g-3 mb-4">
        {walletCards.map(s => (
          <div className="col-6 col-md-3" key={s.label}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background:s.bg, color:s.color }}>{s.icon}</div>
              <div className="stat-value" style={{ color:s.color, fontSize:'1.05rem' }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Section tabs */}
      <div className="section-tabs mb-3">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`section-tab${activeSection===tab.key?' active':''}`}
            onClick={() => setActiveSection(tab.key)}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Bills section */}
      {activeSection === 'bills' && (
        <div className="table-card">
          <div className="card-header-row">
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              <div className="search-wrap">
                <span className="search-icon"><FiSearch /></span>
                <input
                  className="form-control form-control-sm"
                  style={{ width:320, maxWidth:'100%' }}
                  placeholder="Search subscriber, phone, meter, invoice..."
                  value={filters.search}
                  onChange={e => setFilters(f => ({ ...f, search:e.target.value }))}
                />
              </div>
              <AppSelect
                className="form-select form-select-sm"
                style={{ width:120 }}
                value={filters.month}
                onChange={e => setFilters(f => ({ ...f, month:Number(e.target.value) || f.month }))}
              >
                {MONTHS.slice(1).map((m, idx) => (
                  <option key={idx+1} value={idx+1}>{m}</option>
                ))}
              </AppSelect>
              <input
                type="number"
                className="form-control form-control-sm"
                style={{ width:92 }}
                value={filters.year}
                min={2020}
                onChange={e => setFilters(f => ({ ...f, year:Number(e.target.value) || f.year }))}
              />
              <AppSelect
                className="form-select form-select-sm"
                style={{ width:130 }}
                value={filters.status}
                onChange={e => setFilters(f => ({ ...f, status:e.target.value }))}
              >
                <option value="">{t.allStatuses || 'All Statuses'}</option>
                <option value="unpaid">{t.unpaid}</option>
                <option value="partially_paid">{t.partially_paid || 'Partially Paid'}</option>
                <option value="paid">{t.paid}</option>
                <option value="waived">{t.waived}</option>
              </AppSelect>
            </div>
            <span style={{ fontSize:'0.76rem', color:'var(--text-muted)' }}>{bills.length} {t.bills.toLowerCase()}</span>
          </div>

          <div style={{ padding:'10px 14px', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
            <div style={{ fontWeight:700, color:'var(--text)', marginBottom:8 }}>
              {t.unpaidPeriods || 'Unpaid Periods'}
            </div>
            {unpaidPeriods.length ? (
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {unpaidPeriods.map((item) => (
                  <span key={item.id} className="badge-unpaid">
                    {`${item.subscriber_name} - ${MONTHS[item.month]} ${item.year}`}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>{t.noData}</div>
            )}
          </div>

          {combinableGroups.length > 0 && (
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', display:'grid', gap:10 }}>
              <div style={{ fontWeight:700, color:'var(--text)' }}>
                {t.combineUnpaidBills || 'Combine Unpaid Bills'}
              </div>
              {combinableGroups.map((group) => (
                <div
                  key={group.key}
                  style={{
                    display:'flex',
                    justifyContent:'space-between',
                    alignItems:'center',
                    gap:12,
                    flexWrap:'wrap',
                    border:'1px solid var(--border)',
                    borderRadius:'var(--radius-sm)',
                    padding:'10px 12px',
                    background:'var(--bg3)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight:700, color:'var(--text)' }}>
                      {group.subscriber_name} - {group.entries.length} {t.bills?.toLowerCase?.() || 'bills'}
                    </div>
                    <div style={{ fontSize:'0.78rem', color:'var(--text-sub)', marginTop:2 }}>
                      {group.entries.map((entry) => entry.label).join(', ')}
                    </div>
                  </div>
                  <button
                    className="btn btn-sm btn-outline-warning"
                    onClick={() => openCombineModal(group)}
                    disabled={combiningKey === group.key}
                  >
                    {combiningKey === group.key
                      ? (t.loading || 'Loading...')
                      : (t.combineBillsAction || 'Combine Bills')}
                  </button>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}><div className="spinner-border" /></div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="d-md-none" style={{ padding:'10px 12px' }}>
                {pagedBills.map(b => (
                  <div className="data-card" key={b.id}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:'0.9rem' }}>{b.subscriber_name}</div>
                        <code style={{ fontSize:'0.74rem' }}>{b.invoice_number}</code>
                      </div>
                      <span className={`badge-${b.status}`}>{t[b.status]||b.status}</span>
                    </div>
                    <div className="data-card-row">
                      <span style={{ fontWeight:700, color:'var(--text)' }}>{fmtLbp(resolveBillDueLbp(b))}</span>
                      <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{MONTHS[b.month]} {b.year}</span>
                    </div>
                    <div style={{ fontSize:'0.74rem', color:'var(--text-muted)', marginTop:6 }}>
                      {t.billLabel || 'Bill'}: {fmtLbp(b.total_ttc_lbp)} | {t.previousBalance || 'Previous balance'}: {fmtLbp(b.previous_balance_lbp || 0)}
                    </div>
                    <div style={{ fontSize:'0.74rem', color:'var(--text-muted)', marginTop:2 }}>
                      {t.amountDue || 'Amount due'}: {fmtUsd(resolveBillDueUsd(b))} | {t.carryNext || 'Carry next'}: {fmtUsd(Number(b.remaining_balance_usd || 0))}
                    </div>
                    <div style={{ display:'flex', gap:6, marginTop:8 }}>
                      {b.status==='paid' && (
                        <button className="btn btn-sm btn-outline-primary" onClick={()=>handlePrintInvoice(b.id)} title={t.printInvoice}>
                          <FiPrinter />
                        </button>
                      )}
                      {['unpaid','partially_paid'].includes(b.status) && (
                        <button className="btn btn-sm btn-outline-success" onClick={()=>openPaymentModal(b)}>
                          <FiCheckCircle /> {t.markPaid}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {!bills.length && (
                  <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)', fontSize:'0.88rem' }}>{t.noBillsFound || 'No bills found'}</div>
                )}
              </div>

              {/* Desktop table */}
              <div className="d-none d-md-block table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>{t.invoice} #</th><th>{t.subscriber}</th><th>{t.period}</th>
                      <th>{t.totalTTC}</th><th>{t.status}</th><th>{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedBills.map(b => (
                      <tr key={b.id}>
                        <td><code>{b.invoice_number}</code></td>
                        <td>
                          <div style={{ fontWeight:500 }}>{b.subscriber_name}</div>
                          <div style={{ fontSize:'0.76rem', color:'var(--text-muted)' }}>{b.subscriber_phone}</div>
                        </td>
                        <td style={{ fontSize:'0.84rem' }}>{MONTHS[b.month]} {b.year}</td>
                        <td style={{ fontWeight:700 }}>
                          {fmtLbp(resolveBillDueLbp(b))}
                          <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
                            {t.billLabel || 'Bill'}: {fmtLbp(b.total_ttc_lbp)}
                          </div>
                          <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
                            {t.previousBalance || 'Previous balance'}: {fmtLbp(b.previous_balance_lbp || 0)}
                          </div>
                          <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
                            {t.carryNext || 'Carry next'}: {fmtLbp(b.remaining_balance_lbp || 0)}
                          </div>
                        </td>
                        <td><span className={`badge-${b.status}`}>{t[b.status]||b.status}</span></td>
                        <td>
                          <div style={{ display:'flex', gap:5 }}>
                            {b.status==='paid' && (
                              <button className="btn btn-sm btn-outline-primary" title={t.printInvoice} onClick={()=>handlePrintInvoice(b.id)}>
                                <FiPrinter />
                              </button>
                            )}
                            {['unpaid','partially_paid'].includes(b.status) && (
                              <button className="btn btn-sm btn-outline-success" onClick={()=>openPaymentModal(b)}>
                                <FiCheckCircle /> {t.markPaid}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!bills.length && (
                      <tr><td colSpan={6} className="text-center text-muted py-4" style={{ fontSize:'0.84rem' }}>{t.noBillsFound || 'No bills found'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="pagination-wrap">
                  <span className="pagination-info">Page {page} of {totalPages} — {bills.length} bills</span>
                  <div className="pagination-btns">
                    <button className="page-btn" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>‹</button>
                    {Array.from({length:Math.min(totalPages,5)},(_,i)=>i+1).map(p=>(
                      <button key={p} className={`page-btn${page===p?' active':''}`} onClick={()=>setPage(p)}>{p}</button>
                    ))}
                    <button className="page-btn" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>›</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <Modal show={showPaymentModal} onHide={()=>setShowPaymentModal(false)}>
        <Modal.Header closeButton><Modal.Title>{t.recordPayment || 'Record Payment'}</Modal.Title></Modal.Header>
        <Modal.Body>
          <form id="collectorBillPaymentForm" onSubmit={handleMarkPaid}>
            <div style={{ background:'var(--bg3)', borderRadius:'var(--radius-sm)', padding:'12px', marginBottom:14 }}>
              <div style={{ fontWeight:600, color:'var(--text)' }}>{selectedPaymentBill?.subscriber_name}</div>
              <div style={{ fontSize:'0.8rem', color:'var(--text-sub)', marginTop:2 }}>
                {selectedPaymentBill ? `${MONTHS[Number(selectedPaymentBill.month) || now.month]} ${selectedPaymentBill.year}` : ''}
              </div>
              <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginTop:6 }}>
                {t.currentBill || 'Current bill'}: <strong style={{ color:'var(--text)' }}>{fmtUsd(Number(selectedPaymentBill?.total_usd || 0))}</strong>
              </div>
              <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginTop:4 }}>
                {t.previousBalance || 'Previous balance'}: <strong style={{ color:'var(--text)' }}>{fmtUsd(Number(selectedPaymentBill?.previous_balance_usd || 0))}</strong>
              </div>
              <div style={{ fontSize:'0.82rem', color:'var(--accent)', marginTop:6 }}>
                {t.amountDue || 'Amount due'}: {selectedPaymentBill ? `${fmtUsd(resolveBillDueUsd(selectedPaymentBill))} (${fmtLbp(resolveBillDueLbp(selectedPaymentBill))})` : '-'}
              </div>
            </div>
            <div>
              <label className="form-label">{t.amountReceivedUsd || 'Amount received (USD)'}</label>
              <input
                type="number"
                className="form-control"
                value={paymentAmountUsd}
                onChange={(e) => setPaymentAmountUsd(e.target.value)}
                min={0}
                step={0.01}
                required
                autoFocus
              />
              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:4 }}>
                {t.settlementCarryForwardHelp || 'Any difference will move automatically to the next bill as debt or credit.'}
              </div>
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={()=>setShowPaymentModal(false)}>{t.cancel}</button>
          <button type="submit" form="collectorBillPaymentForm" className="btn btn-primary" disabled={savingPayment}>
            {savingPayment ? (t.loading || 'Loading...') : (t.markPaid || 'Save Payment')}
          </button>
        </Modal.Footer>
      </Modal>

      {/* Settlement request section */}
      {activeSection === 'settlement' && (
        <div className="table-card" style={{ padding:20 }}>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:'0.88rem', fontWeight:600, color:'var(--text)', marginBottom:4 }}>
              {t.available}: <span style={{ color:'var(--accent)' }}>{fmtLbp(wallet.available_lbp)}</span>
            </div>
            <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>
              {t.pendingOwnerConfirm || 'Pending owner confirm'}: {fmtLbp(wallet.pending_lbp)}
            </div>
          </div>

          <form onSubmit={handleRequestSettlement}>
            <div className="row g-3 align-items-end">
              <div className="col-md-5">
                <label className="form-label">{t.amount || 'Amount'} (LBP) *</label>
                <div style={{ display:'flex', gap:8 }}>
                  <input
                    type="number" className="form-control"
                    value={requestForm.amount_lbp}
                    onChange={e => setRequestForm(f=>({...f,amount_lbp:e.target.value}))}
                    min={0.01} step={0.01} required
                    autoFocus
                  />
                  <button
                    type="button" className="btn btn-outline-primary"
                    onClick={handleFillFullPayment}
                    disabled={wallet.available_lbp <= 0}
                    style={{ whiteSpace:'nowrap' }}
                  >
                    {t.full || 'Full'}
                  </button>
                </div>
              </div>
              <div className="col-md-5">
                <label className="form-label">{t.notes} (optional)</label>
                <input
                  className="form-control" value={requestForm.notes}
                  onChange={e => setRequestForm(f=>({...f,notes:e.target.value}))}
                  maxLength={500}
                />
              </div>
              <div className="col-md-2">
                <button
                  className="btn btn-primary w-100"
                  style={{ justifyContent:'center' }}
                  disabled={requesting || wallet.available_lbp <= 0}
                >
                  {requesting
                    ? <span className="spinner-border spinner-border-sm" />
                    : <><FiSend /> {t.recordSettlement}</>
                  }
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Settlement history section */}
      {activeSection === 'history' && (
        <div className="table-card">
          <div className="card-header-row">
            <span className="card-title">{t.settlements}</span>
          </div>
          <div className="d-md-none">
            {settlements.length ? (
              <div className="settlement-mobile-grid">
                {settlements.map((s) => (
                  <div className="settlement-mobile-card" key={s.id}>
                    <div className="settlement-mobile-row">
                      <div>
                        <div className="settlement-mobile-label">#</div>
                        <div style={{ color:'var(--text-muted)', fontSize:'0.84rem' }}>#{s.id}</div>
                      </div>
                      <span className={`badge-${s.status}`}>{s.status}</span>
                    </div>
                    <div className="settlement-mobile-row">
                      <div>
                        <div className="settlement-mobile-label">{t.amount || 'Amount'}</div>
                        <div style={{ fontWeight:700 }}>{fmtLbp(s.amount_lbp)}</div>
                      </div>
                    </div>
                    <div className="settlement-mobile-row">
                      <div>
                        <div className="settlement-mobile-label">{t.requested || 'Requested'}</div>
                        <div style={{ fontSize:'0.82rem' }}>{formatDateTimeUtcPlus2(s.requested_at)}</div>
                      </div>
                    </div>
                    <div className="settlement-mobile-row">
                      <div>
                        <div className="settlement-mobile-label">{t.confirmed || 'Confirmed'}</div>
                        <div style={{ fontSize:'0.82rem' }}>{s.confirmed_at ? formatDateTimeUtcPlus2(s.confirmed_at) : '—'}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign:'center', padding:'28px 12px', color:'var(--text-muted)', fontSize:'0.84rem' }}>
                {t.noSettlementRequestsYet || 'No settlement requests yet'}
              </div>
            )}
          </div>
          <div className="table-responsive d-none d-md-block">
            <table className="table table-hover mb-0">
              <thead>
                <tr><th>#</th><th>{t.amount || 'Amount'}</th><th>{t.status}</th><th>{t.requested || 'Requested'}</th><th>{t.confirmed || 'Confirmed'}</th></tr>
              </thead>
              <tbody>
                {settlements.map(s => (
                  <tr key={s.id}>
                    <td style={{ color:'var(--text-muted)', fontSize:'0.84rem' }}>#{s.id}</td>
                    <td style={{ fontWeight:700 }}>{fmtLbp(s.amount_lbp)}</td>
                    <td><span className={`badge-${s.status}`}>{s.status}</span></td>
                    <td style={{ fontSize:'0.82rem' }}>{formatDateTimeUtcPlus2(s.requested_at)}</td>
                    <td style={{ fontSize:'0.82rem' }}>{s.confirmed_at ? formatDateTimeUtcPlus2(s.confirmed_at) : '—'}</td>
                  </tr>
                ))}
                {!settlements.length && (
                  <tr><td colSpan={5} className="text-center text-muted py-4" style={{ fontSize:'0.84rem' }}>{t.noSettlementRequestsYet || 'No settlement requests yet'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
          <Modal.Title>{t.combineUnpaidBills || 'Combine Unpaid Bills'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div style={{ fontSize:'0.9rem', color:'var(--text)', fontWeight:700, marginBottom:8 }}>
            {combineTarget?.subscriber_name || '-'}
          </div>
          <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:10 }}>
            {t.combineMonthsIntoInvoice || 'Select the months to combine into one invoice.'}
          </div>
          <div style={{ display:'grid', gap:8 }}>
            {(combineTarget?.entries || []).map((entry) => (
              <label
                key={entry.id}
                style={{
                  display:'flex',
                  justifyContent:'space-between',
                  alignItems:'center',
                  gap:8,
                  border:'1px solid var(--border)',
                  borderRadius:'var(--radius-sm)',
                  padding:'8px 10px',
                  background:'var(--bg3)',
                }}
              >
                <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input
                    type="checkbox"
                    checked={selectedCombineIds.includes(entry.id)}
                    onChange={() => handleToggleCombineId(entry.id)}
                  />
                  <span>{entry.label}</span>
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
              ? (t.loading || 'Loading...')
              : (t.combineBillsAction || 'Combine Bills')}
          </button>
        </Modal.Footer>
      </Modal>

    </div>
  );
}
