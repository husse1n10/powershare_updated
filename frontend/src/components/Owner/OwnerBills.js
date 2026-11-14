import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal } from 'react-bootstrap';
import { FiEdit2, FiPrinter, FiSearch, FiCheckCircle, FiTrash2, FiSave, FiRefreshCw, FiMessageCircle, FiBell } from 'react-icons/fi';
import api from '../../services/api';
import { useLang } from '../../contexts/LangContext';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';
import { getCurrentMonthYearUtcPlus2 } from '../../utils/timezone';
import { MONTHS_EN, MONTHS_AR } from '../../i18n';
import { printInvoiceDirect } from '../Shared/InvoicePrint';
import AppSelect from '../Shared/AppSelect';

function isActiveSubscription(r) { return Number(r?.sub_active)===1 || r?.sub_active===true; }
function matchesSearch(sub, q) {
  const s = String(q||'').trim().toLowerCase();
  if (!s) return true;
  return String(sub?.full_name||'').toLowerCase().includes(s)
    || String(sub?.meter_number||'').toLowerCase().includes(s)
    || String(sub?.main_meter_number||'').toLowerCase().includes(s);
}

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
  if (Number.isFinite(usd) && usd >= 0 && (usd > 0 || lbp <= 0)) return usd;
  return toUsd(lbp, bill?.usd_lbp_rate || fallbackRate);
}

function resolveBillDueUsd(bill, fallbackRate = 89700) {
  const usd = Number(bill?.amount_due_usd);
  const lbp = Number(bill?.amount_due_lbp);
  if (Number.isFinite(usd)) return usd;
  if (Number.isFinite(lbp)) return toUsd(lbp, bill?.usd_lbp_rate || fallbackRate);
  return resolveBillUsd(bill, fallbackRate);
}

function resolveBillDueLbp(bill) {
  const amountDue = Number(bill?.amount_due_lbp);
  if (Number.isFinite(amountDue)) return amountDue;
  return Number(bill?.total_ttc_lbp || 0);
}

function isOpenBill(bill) {
  return ['unpaid', 'partially_paid'].includes(String(bill?.status || ''));
}

function resolveBillRemainingUsd(bill, fallbackRate = 89700) {
  const usd = Number(bill?.remaining_balance_usd);
  const lbp = Number(bill?.remaining_balance_lbp);
  if (Number.isFinite(usd)) return Math.max(0, usd);
  if (Number.isFinite(lbp)) return Math.max(0, toUsd(lbp, bill?.usd_lbp_rate || fallbackRate));
  return resolveBillDueUsd(bill, fallbackRate);
}

function resolveBillRemainingLbp(bill) {
  const lbp = Number(bill?.remaining_balance_lbp);
  return Number.isFinite(lbp) ? Math.max(0, lbp) : Math.max(0, resolveBillDueLbp(bill));
}

function resolveBillReceivedUsd(bill, fallbackRate = 89700) {
  const usd = Number(bill?.amount_received_usd);
  const lbp = Number(bill?.amount_received_lbp);
  if (Number.isFinite(usd)) return usd;
  if (Number.isFinite(lbp)) return toUsd(lbp, bill?.usd_lbp_rate || fallbackRate);
  return 0;
}

function resolveBillReceivedLbp(bill) {
  const amountReceived = Number(bill?.amount_received_lbp);
  return Number.isFinite(amountReceived) ? amountReceived : 0;
}


function fmtBillDual(bill, fallbackRate = 89700) {
  return `${fmtUsd(resolveBillDueUsd(bill, fallbackRate))} (${Number(resolveBillDueLbp(bill) || 0).toLocaleString()} LBP)`;
}

function fmtSignedDual(usd, lbp) {
  return `${fmtUsd(usd)} (${Number(lbp || 0).toLocaleString()} LBP)`;
}

function toFiniteNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getPeriodEndDateIso(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return null;
  const endDate = new Date(Date.UTC(y, m, 0));
  const yyyy = endDate.getUTCFullYear();
  const mm = String(endDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(endDate.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getReadingContextForPeriod(readings, year, month, initialKwh) {
  const periodEnd = getPeriodEndDateIso(year, month);
  const normalized = Array.isArray(readings)
    ? readings
      .map((row) => ({
        id: Number(row?.id || 0),
        date: String(row?.reading_date || '').slice(0, 10),
        readingValue: toFiniteNumber(row?.reading_value),
        previousValue: toFiniteNumber(row?.previous_value),
        hasLinkedBill: Number(row?.bill_id || 0) > 0,
      }))
      .filter((row) => row.date && Number.isFinite(row.readingValue))
    : [];

  let previousForPeriod = null;
  let nextAfterPeriod = null;

  const isBetterPreviousCandidate = (candidate, current) => {
    if (!candidate) return false;
    if (!current) return true;
    if (candidate.date !== current.date) return candidate.date > current.date;
    if (candidate.hasLinkedBill !== current.hasLinkedBill) return candidate.hasLinkedBill;
    return candidate.id > current.id;
  };

  const isBetterNextCandidate = (candidate, current) => {
    if (!candidate) return false;
    if (!current) return true;
    if (candidate.date !== current.date) return candidate.date < current.date;
    if (candidate.hasLinkedBill !== current.hasLinkedBill) return candidate.hasLinkedBill;
    return candidate.id > current.id;
  };

  for (const row of normalized) {
    if (periodEnd && row.date <= periodEnd && isBetterPreviousCandidate(row, previousForPeriod)) {
      previousForPeriod = row;
    }
    if (periodEnd && row.date > periodEnd && isBetterNextCandidate(row, nextAfterPeriod)) {
      nextAfterPeriod = row;
    }
  }

  const baselinePrevious = previousForPeriod?.readingValue ?? toFiniteNumber(initialKwh) ?? 0;
  const lockedNewReading = toFiniteNumber(nextAfterPeriod?.previousValue);

  return {
    previousValue: baselinePrevious,
    lockedNewReading,
  };
}

function normalizeWhatsAppPhone(rawPhone) {
  const digits = String(rawPhone || '').replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.startsWith('961')) return digits;
  if (digits.startsWith('0')) return `961${digits.slice(1)}`;
  return digits;
}

function buildWhatsAppBillText({ subscriber, bill, monthLabel, totalLabel }) {
  const readingText = (bill?.prev_reading != null && bill?.current_reading != null)
    ? `${Number(bill.prev_reading).toLocaleString(undefined, { maximumFractionDigits: 2 })} -> ${Number(bill.current_reading).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : '-';
  return [
    `مرحباً ${subscriber?.full_name || ''}،`,
    'فاتورة المولد الخاصة بك جاهزة.',
    `رقم الفاتورة: ${bill?.invoice_number || '-'}`,
    `الشهر: ${monthLabel}`,
    `رقم العداد: ${subscriber?.meter_number || '-'}`,
    `القراءة: ${readingText}`,
    `الإجمالي: ${totalLabel}`,
    '',
    `Hello ${subscriber?.full_name || ''},`,
    'Your generator bill is ready.',
    `Invoice: ${bill?.invoice_number || '-'}`,
    `Month: ${monthLabel}`,
    `Meter: ${subscriber?.meter_number || '-'}`,
    `Reading: ${readingText}`,
    `Total: ${totalLabel}`,
  ].join('\n');
}

const PAGE_SIZE = 15;

export default function OwnerBills() {
  const { t, lang } = useLang();
  const confirm = useConfirmDialog();
  const MONTHS = lang==='ar' ? MONTHS_AR : MONTHS_EN;
  const now = getCurrentMonthYearUtcPlus2();
  const [period, setPeriod] = useState({ month:now.month, year:now.year });
  const [subscribers, setSubscribers] = useState([]);
  const [bills, setBills] = useState([]);
  const [planPricing, setPlanPricing] = useState([]);
  const [pricingDrafts, setPricingDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingPricingPlanId, setSavingPricingPlanId] = useState(null);
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('need');
  const [completedStatusFilter, setCompletedStatusFilter] = useState('unpaid');
  const [msg, setMsg] = useState(null);
  const [page, setPage] = useState(1);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [selectedSubscriber, setSelectedSubscriber] = useState(null);
  const [entryForm, setEntryForm] = useState({ previous_reading:'', new_meter_reading:'', notes:'' });
  const [readingContext, setReadingContext] = useState({ loading:false, previousValue:null, lockedNewReading:null });
  const [savingEntry, setSavingEntry] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentRow, setSelectedPaymentRow] = useState(null);
  const [paymentAmountUsd, setPaymentAmountUsd] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [subsRes, billsRes, pricingRes] = await Promise.all([
        api.get('/owner/subscribers'),
        api.get('/owner/bills', { params:{ month:period.month, year:period.year } }),
        api.get('/owner/plan-pricing-rules', { params:{ month:period.month, year:period.year } }),
      ]);
      setSubscribers((subsRes.data||[]).filter(isActiveSubscription));
      setBills(billsRes.data||[]);
      const rows = pricingRes.data?.plans||[];
      setPlanPricing(rows);
      setPricingDrafts(rows.reduce((acc,row) => {
        acc[row.plan_id] = { threshold_kwh:row.threshold_kwh??100, base_cost_below_lbp:row.base_cost_below_lbp??row.default_base_cost_lbp??0, base_cost_above_lbp:row.base_cost_above_lbp??row.default_base_cost_lbp??0, maintenance_lbp:row.maintenance_lbp??row.default_maintenance_lbp??0 };
        return acc;
      }, {}));
    } catch (err) { setMsg({ type:'danger', text: err.response?.data?.error||'Failed to load' }); }
    finally { setLoading(false); }
  }, [period.month, period.year]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [activeSection, search, completedStatusFilter]);

  const billsMap = useMemo(() => { const m=new Map(); bills.forEach(b=>m.set(Number(b.subscription_id),b)); return m; }, [bills]);
  const filteredSubs = useMemo(() => subscribers.filter(s=>matchesSearch(s,search)), [subscribers,search]);
  const pending = useMemo(() => filteredSubs.filter(s=>!billsMap.has(Number(s.subscription_id))), [filteredSubs,billsMap]);
  const completed = useMemo(() => filteredSubs.map(s=>({subscriber:s,bill:billsMap.get(Number(s.subscription_id))})).filter(r=>!!r.bill), [filteredSubs,billsMap]);
  const completedFiltered = useMemo(
    () => completed.filter((row) => completedStatusFilter === 'all' ? true : completedStatusFilter === 'unpaid' ? isOpenBill(row.bill) : row.bill?.status === completedStatusFilter),
    [completed, completedStatusFilter]
  );
  const fallbackUsdRate = useMemo(() => {
    const match = bills.find((b) => Number(b?.usd_lbp_rate) > 0);
    return Number(match?.usd_lbp_rate || 89700) || 89700;
  }, [bills]);
  const totalPendingLbp = useMemo(
    () => completed.filter(r=>isOpenBill(r.bill)).reduce((sum,r)=>sum + resolveBillRemainingLbp(r.bill),0),
    [completed]
  );
  const totalPendingUsd = useMemo(
    () => completed
      .filter((r) => isOpenBill(r.bill))
      .reduce((sum, r) => sum + resolveBillRemainingUsd(r.bill, fallbackUsdRate), 0),
    [completed, fallbackUsdRate]
  );
  const totalPaidLbp = useMemo(
    () => completed
      .filter((r) => r.bill.status === 'paid')
      .reduce((sum, r) => sum + resolveBillReceivedLbp(r.bill), 0),
    [completed]
  );
  const totalPaidUsd = useMemo(
    () => completed
      .filter((r) => r.bill.status === 'paid')
      .reduce((sum, r) => sum + resolveBillReceivedUsd(r.bill, fallbackUsdRate), 0),
    [completed, fallbackUsdRate]
  );
  const currentList = activeSection==='need' ? pending : activeSection==='completed' ? completedFiltered : planPricing;
  const totalPages = Math.max(1, Math.ceil(currentList.length / PAGE_SIZE));
  const paged = currentList.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const isSelectedFixedAmount = Number(selectedSubscriber?.fixed_amount_enabled) === 1
    && Number(selectedSubscriber?.fixed_amount_usd || 0) > 0;
  const selectedFixedAmountUsd = Number(selectedSubscriber?.fixed_amount_usd || 0);
  const hasLockedNewReading = Number.isFinite(readingContext?.lockedNewReading);

  const openEntryModal = async (subscriber) => {
    const fallbackPrevious = toFiniteNumber(subscriber?.last_reading_value)
      ?? toFiniteNumber(subscriber?.initial_kwh_consumed)
      ?? 0;

    setSelectedSubscriber(subscriber);
    setShowEntryModal(true);
    setEntryForm({
      previous_reading: String(fallbackPrevious),
      new_meter_reading: '',
      notes: '',
    });
    setReadingContext({
      loading: true,
      previousValue: fallbackPrevious,
      lockedNewReading: null,
    });

    try {
      const res = await api.get(`/owner/subscriptions/${subscriber.subscription_id}/readings`);
      const context = getReadingContextForPeriod(
        res.data || [],
        period.year,
        period.month,
        subscriber?.initial_kwh_consumed
      );
      const previousValue = Number.isFinite(context.previousValue) ? context.previousValue : fallbackPrevious;
      const lockedNewReading = Number.isFinite(context.lockedNewReading) ? context.lockedNewReading : null;
      setReadingContext({
        loading: false,
        previousValue,
        lockedNewReading,
      });
      setEntryForm({
        previous_reading: String(previousValue),
        new_meter_reading: lockedNewReading !== null ? String(lockedNewReading) : '',
        notes: '',
      });
    } catch (err) {
      setReadingContext({
        loading: false,
        previousValue: fallbackPrevious,
        lockedNewReading: null,
      });
      setMsg({
        type: 'warning',
        text: err.response?.data?.error || t.readingHistoryLoadFailed || 'Could not load reading history. You can still enter readings manually.',
      });
    }
  };

  const handleSubmitEntry = async (e) => {
    e.preventDefault();
    if (!selectedSubscriber) return;
    const requiresNewReading = !isSelectedFixedAmount || hasLockedNewReading;
    if (requiresNewReading && String(entryForm.new_meter_reading || '').trim() === '') {
      setMsg({ type:'danger', text:t.newReadingRequiredForSubscriber || 'New meter reading is required for this subscriber.' });
      return;
    }
    if (hasLockedNewReading) {
      const enteredValue = toFiniteNumber(entryForm.new_meter_reading);
      const expectedValue = toFiniteNumber(readingContext.lockedNewReading);
      if (!Number.isFinite(enteredValue) || !Number.isFinite(expectedValue) || Math.abs(enteredValue - expectedValue) > 0.0001) {
        setMsg({ type:'danger', text:`${t.newReadingMustStay || 'For this period, new reading must stay'} ${expectedValue}.` });
        return;
      }
    }
    setSavingEntry(true);
    try {
      const payload = {
        subscription_id:selectedSubscriber.subscription_id,
        month:period.month,
        year:period.year,
        notes:entryForm.notes,
      };
      if (String(entryForm.new_meter_reading || '').trim() !== '') {
        payload.new_meter_reading = entryForm.new_meter_reading;
      }
      if (String(entryForm.previous_reading || '').trim() !== '') {
        payload.previous_reading = entryForm.previous_reading;
      }
      await api.post('/owner/bills', payload);
      setShowEntryModal(false); setMsg({ type:'success', text:t.billGenerated || 'Bill generated.' }); load();
    } catch (err) {
      setMsg({ type:'danger', text: err.response?.data?.error||'Failed' });
      if (err.response?.status===409) { setShowEntryModal(false); load(); }
    } finally { setSavingEntry(false); }
  };

  const handlePrintInvoice = async (billId, options = {}) => {
    const { silent = false, existingWindow = null } = options;
    const printWindow = existingWindow || window.open('', '_blank');
    if (!printWindow) {
      if (!silent) setMsg({ type:'danger', text:'Please allow pop-ups to print invoice.' });
      return false;
    }

    printWindow.document.open();
    printWindow.document.write('<html><head><title>Preparing invoice...</title></head><body style="font-family:Arial,sans-serif;padding:20px;">Preparing invoice...</body></html>');
    printWindow.document.close();

    try {
      const res = await api.get(`/owner/bills/${billId}`);
      await printInvoiceDirect({
        bill: res.data?.bill,
        owner: res.data?.owner,
        targetWindow: printWindow,
      });
      return true;
    } catch (err) {
      try { printWindow.close(); } catch {}
      if (!silent) setMsg({ type:'danger', text: err.response?.data?.error || 'Could not load invoice' });
      return false;
    }
  };

  const openPaymentModal = ({ subscriber, bill }) => {
    setSelectedPaymentRow({ subscriber, bill });
    setPaymentAmountUsd(resolveBillRemainingUsd(bill, fallbackUsdRate).toFixed(2));
    setShowPaymentModal(true);
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!selectedPaymentRow?.bill?.id) return;
    const autoPrintWindow = window.open('', '_blank');
    if (autoPrintWindow) {
      autoPrintWindow.document.open();
      autoPrintWindow.document.write('<html><head><title>Preparing invoice...</title></head><body style="font-family:Arial,sans-serif;padding:20px;">Preparing invoice...</body></html>');
      autoPrintWindow.document.close();
    }

    setSavingPayment(true);
    try {
      await api.put(`/owner/bills/${selectedPaymentRow.bill.id}/pay`, {
        amount_received_usd: paymentAmountUsd,
      });
      setShowPaymentModal(false);
      const printed = autoPrintWindow
        ? await handlePrintInvoice(selectedPaymentRow.bill.id, { silent: true, existingWindow: autoPrintWindow })
        : false;
      if (printed) {
        setMsg({ type:'success', text:t.markedPaidAndOpenedInvoice || 'Marked paid and opened invoice for printing.' });
      } else if (!autoPrintWindow) {
        setMsg({ type:'warning', text:t.markedPaidAllowPopups || 'Marked paid. Please allow pop-ups to print invoice automatically.' });
      } else {
        setMsg({ type:'warning', text:t.markedPaidInvoiceLoadFailed || 'Marked paid, but invoice could not be loaded for printing.' });
      }
      load();
    }
    catch (err) {
      try { if (autoPrintWindow) autoPrintWindow.close(); } catch {}
      setMsg({ type:'danger', text: err.response?.data?.error||'Failed' });
    } finally {
      setSavingPayment(false);
    }
  };

  const handleBalanceReminder = async (billId) => {
    try {
      await api.post(`/owner/bills/${billId}/remind`);
      setMsg({ type:'success', text:'Outstanding balance reminder sent to the subscriber.' });
    } catch (err) {
      setMsg({ type:'danger', text:err.response?.data?.error || 'Could not send balance reminder.' });
    }
  };

  const handleDelete = async (billId) => {
    const approved = await confirm({
      title: t.deleteBillTitle || 'Delete Bill',
      message: t.deleteBillMessage || 'Delete this bill?',
      confirmText: t.delete,
      intent: 'danger',
    });
    if (!approved) return;
    try { await api.delete(`/owner/bills/${billId}`); setMsg({ type:'warning', text:t.deleted || 'Deleted.' }); load(); }
    catch (err) { setMsg({ type:'danger', text: err.response?.data?.error||'Failed' }); }
  };

  const handleWhatsAppBill = ({ subscriber, bill }) => {
    const phone = normalizeWhatsAppPhone(subscriber?.phone);
    if (!phone) {
      setMsg({ type:'warning', text:t.invalidWhatsAppPhone || 'This subscriber does not have a valid WhatsApp phone number.' });
      return;
    }

    const monthLabel = `${MONTHS[Number(bill?.month) || period.month]} ${bill?.year || period.year}`;
    const totalLabel = fmtBillDual(bill, fallbackUsdRate);
    const text = buildWhatsAppBillText({
      subscriber,
      bill,
      monthLabel,
      totalLabel,
    });

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const handlePricingChange = (planId,field,value) => setPricingDrafts(prev=>({...prev,[planId]:{...(prev[planId]||{}),[field]:value}}));

  const handleSavePricing = async (planId) => {
    const draft = pricingDrafts[planId]; if (!draft) return;
    setSavingPricingPlanId(planId);
    try { await api.put('/owner/plan-pricing-rules', { plan_id:planId, month:period.month, year:period.year, threshold_kwh:Number(draft.threshold_kwh), base_cost_below_lbp:Number(draft.base_cost_below_lbp), base_cost_above_lbp:Number(draft.base_cost_above_lbp), maintenance_lbp:Number(draft.maintenance_lbp) }); setMsg({ type:'success', text:'Pricing saved.' }); load(); }
    catch (err) { setMsg({ type:'danger', text: err.response?.data?.error||'Failed' }); }
    finally { setSavingPricingPlanId(null); }
  };

  const handleResetPricing = async (planId) => {
    const approved = await confirm({
      title: 'Reset Pricing',
      message: 'Reset this plan pricing to defaults?',
      confirmText: t.reset,
      intent: 'warning',
    });
    if (!approved) return;
    setSavingPricingPlanId(planId);
    try { await api.delete(`/owner/plan-pricing-rules/${planId}`, { params:{ month:period.month, year:period.year } }); setMsg({ type:'warning', text:'Reset.' }); load(); }
    catch (err) { setMsg({ type:'danger', text: err.response?.data?.error||'Failed' }); }
    finally { setSavingPricingPlanId(null); }
  };

  const PaginationBar = () => totalPages<=1 ? null : (
    <div className="pagination-wrap">
      <span className="pagination-info">{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,currentList.length)} / {currentList.length}</span>
      <div className="pagination-btns">
        <button className="page-btn" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>‹</button>
        {Array.from({length:Math.min(5,totalPages)},(_,i)=>{const p=Math.max(1,Math.min(totalPages-4,page-2))+i; return p>=1&&p<=totalPages?<button key={p} className={`page-btn${page===p?' active':''}`} onClick={()=>setPage(p)}>{p}</button>:null;})}
        <button className="page-btn" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>›</button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header"><h4 className="page-title">{t.bills}</h4></div>

      {msg && <div className={`alert alert-${msg.type} alert-dismissible mb-3`}>{msg.text}<button className="btn-close" onClick={()=>setMsg(null)}>✕</button></div>}

      {/* Stats */}
      <div className="row row-cols-2 row-cols-md-3 row-cols-xl-5 g-3 mb-3">
        {[
          { label:t.subscribersInScope, value:filteredSubs.length,                                                      color:'var(--accent)' },
          { label:t.needEntry,          value:pending.length,                                                            color:'var(--warning)' },
          { label:t.completed,          value:completed.length,                                                          color:'var(--success)' },
          {
            label:t.paidForPeriod,
            value:`${fmtUsd(totalPaidUsd)} (${Number(totalPaidLbp).toLocaleString()} LBP)`,
            color:'var(--success)',
          },
          {
            label:t.unpaidForPeriod,
            value:`${fmtUsd(totalPendingUsd)} (${Number(totalPendingLbp).toLocaleString()} LBP)`,
            color:'var(--danger)',
          },
        ].map(s=>(
          <div className="col" key={s.label}>
            <div className="stat-card">
              <div className="stat-value" style={{ color:s.color, fontSize:'1.2rem' }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Controls: period + search + tabs — stacks on mobile */}
      <div className="table-card mb-3">
        <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <AppSelect className="form-select form-select-sm" style={{ width:120, minWidth:110 }} value={period.month} onChange={e=>setPeriod(p=>({...p,month:Number(e.target.value)}))}>
              {Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{MONTHS[i+1]}</option>)}
            </AppSelect>
            <input type="number" className="form-control form-control-sm" style={{ width:84 }} value={period.year} min={2020} onChange={e=>setPeriod(p=>({...p,year:Number(e.target.value)||p.year}))} />
            <div className="search-wrap" style={{ flex:1, minWidth:160 }}>
              <span className="search-icon"><FiSearch /></span>
              <input className="form-control form-control-sm" placeholder={`${t.search}...`} value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
          </div>
          <div className="section-tabs" style={{ alignSelf:'flex-start', maxWidth:'100%' }}>
            <button className={`section-tab${activeSection==='need'?' active':''}`} onClick={()=>setActiveSection('need')}>
              {t.kwhEntry || 'KWh Entry'} ({pending.length})
            </button>
            <button className={`section-tab${activeSection==='completed'?' active':''}`} onClick={()=>setActiveSection('completed')}>
              {t.completed || 'Completed'} ({completedFiltered.length})
            </button>
            <button className={`section-tab${activeSection==='pricing'?' active':''}`} onClick={()=>setActiveSection('pricing')}>
              {t.planPricing}
            </button>
          </div>
        </div>
      </div>

      {/* Need kWh Entry */}
      {activeSection==='need' && (
        <div className="table-card">
          <div className="card-header-row">
            <span className="card-title">{t.kwhEntry || 'KWh Entry'}</span>
            <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{pending.length}</span>
          </div>
          {loading ? <div style={{ display:'flex', justifyContent:'center', padding:'32px 0' }}><div className="spinner-border" /></div> : (
            <>
              {/* Mobile cards */}
              <div className="d-md-none" style={{ padding:'8px 10px' }}>
                {paged.map(s=>(
                  <div className="data-card" key={s.subscription_id}>
                    <div className="data-card-title">{s.full_name}</div>
                    <div className="data-card-sub">{s.plan_name} ({s.ampere}A) · {s.generator_name}</div>
                    {Number(s.fixed_amount_enabled) === 1 && (
                      <div style={{ fontSize:'0.76rem', color:'var(--accent)' }}>
                        {t.fixedBill || 'Fixed bill'}: ${Number(s.fixed_amount_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} (no VAT)
                      </div>
                    )}
                    {s.meter_number && <div style={{ fontSize:'0.76rem', color:'var(--text-muted)' }}>Meter: <code>{s.meter_number}</code></div>}
                    <div style={{ marginTop:8 }}>
                      <button className="btn btn-sm btn-outline-primary" onClick={()=>openEntryModal(s)}><FiEdit2 /> {t.addReading}</button>
                    </div>
                  </div>
                ))}
                {pending.length===0 && <div style={{ textAlign:'center', color:'var(--text-muted)', padding:'36px 0', fontSize:'0.88rem' }}>{t.noPendingSubscribers}</div>}
              </div>
              {/* Desktop table */}
              <div className="d-none d-md-block table-responsive">
                <table className="table table-hover mb-0">
                  <thead><tr><th>{t.subscriber}</th><th>{t.plan}</th><th>{t.generator}</th><th>{t.meterNum}</th><th>{t.mainMeterNum}</th><th>{t.actions}</th></tr></thead>
                  <tbody>
                    {paged.map(s=>(
                      <tr key={s.subscription_id}>
                        <td><div style={{ fontWeight:500 }}>{s.full_name}</div><div style={{ fontSize:'0.77rem', color:'var(--text-muted)' }}>{s.phone||'—'}</div></td>
                        <td>
                          {s.plan_name} <span style={{ color:'var(--text-muted)', fontSize:'0.75rem' }}>({s.ampere}A)</span>
                          {Number(s.fixed_amount_enabled) === 1 && (
                            <div style={{ fontSize:'0.74rem', color:'var(--accent)' }}>
                              Fixed: ${Number(s.fixed_amount_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize:'0.84rem' }}>{s.generator_name}</td>
                        <td><code>{s.meter_number||'—'}</code></td>
                        <td><code>{s.main_meter_number||'—'}</code></td>
                        <td><button className="btn btn-sm btn-outline-primary" onClick={()=>openEntryModal(s)}><FiEdit2 /> {t.addReading}</button></td>
                      </tr>
                    ))}
                    {pending.length===0 && <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--text-muted)', padding:'32px', fontSize:'0.85rem' }}>{t.noPendingSubscribers}</td></tr>}
                  </tbody>
                </table>
              </div>
              <PaginationBar />
            </>
          )}
        </div>
      )}

      {/* Completed */}
      {activeSection==='completed' && (
        <div className="table-card">
          <div className="card-header-row">
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', width:'100%' }}>
              <span className="card-title">{t.completed || 'Completed'}</span>
              <AppSelect
                className="form-select form-select-sm"
                style={{ width: 140 }}
                value={completedStatusFilter}
                onChange={(e) => setCompletedStatusFilter(e.target.value)}
              >
                <option value="unpaid">{t.unpaid}</option>
                <option value="paid">{t.paid}</option>
                <option value="all">{t.allStatuses || 'All Statuses'}</option>
              </AppSelect>
            </div>
            <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{completedFiltered.length}</span>
          </div>
          {loading ? <div style={{ display:'flex', justifyContent:'center', padding:'32px 0' }}><div className="spinner-border" /></div> : (
            <>
              {/* Mobile cards */}
              <div className="d-md-none" style={{ padding:'8px 10px' }}>
                {paged.map(({subscriber:s, bill:b})=>(
                  <div className="data-card" key={b.id}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                      <div style={{ minWidth:0 }}>
                        <div className="data-card-title">{s.full_name}</div>
                        <div className="data-card-sub"><code style={{ fontSize:'0.72rem' }}>{b.invoice_number}</code></div>
                      </div>
                      <span className={`badge-${b.status}`}>{t[b.status]||b.status}</span>
                    </div>
                    <div className="data-card-row">
                      <span style={{ fontWeight:700, color:'var(--text)' }}>{fmtBillDual(b, fallbackUsdRate)}</span>
                      <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{Number(b.kwh_used||0).toLocaleString(undefined,{maximumFractionDigits:2})} kWh</span>
                    </div>
                    <div style={{ fontSize:'0.74rem', color:'var(--text-muted)', marginTop:6 }}>
                      {t.billLabel || 'Bill'}: {fmtSignedDual(resolveBillUsd(b, fallbackUsdRate), Number(b.total_ttc_lbp || 0))}
                    </div>
                    <div style={{ fontSize:'0.74rem', color:'var(--text-muted)', marginTop:2 }}>
                      {t.previousBalance || 'Previous balance'}: {fmtSignedDual(Number(b.previous_balance_usd || 0), Number(b.previous_balance_lbp || 0))}
                    </div>
                    {b.status === 'paid' && (
                      <div style={{ fontSize:'0.74rem', color:'var(--text-muted)', marginTop:2 }}>
                        {t.received || 'Received'}: {fmtSignedDual(resolveBillReceivedUsd(b, fallbackUsdRate), resolveBillReceivedLbp(b))}
                      </div>
                    )}
                    <div style={{ fontSize:'0.74rem', color:'var(--text-muted)', marginTop:2 }}>
                      {t.carryNext || 'Carry next'}: {fmtSignedDual(Number(b.remaining_balance_usd || 0), Number(b.remaining_balance_lbp || 0))}
                    </div>
                    {Number(b.is_fixed_amount) === 1 && (
                      <div style={{ fontSize:'0.76rem', color:'var(--accent)' }}>
                        {t.fixedBill || 'Fixed bill'}: ${Number(b.fixed_amount_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                    )}
                    <div style={{ display:'flex', gap:5, marginTop:8 }}>
                      <button className="btn btn-sm btn-outline-success" onClick={()=>handleWhatsAppBill({ subscriber:s, bill:b })} title="WhatsApp">
                        <FiMessageCircle />
                      </button>
                      <button className="btn btn-sm btn-outline-primary" onClick={()=>handlePrintInvoice(b.id)} title={t.printInvoice}><FiPrinter /></button>
                      {isOpenBill(b) && <button className="btn btn-sm btn-outline-success" onClick={()=>openPaymentModal({ subscriber:s, bill:b })} title={t.markPaid}><FiCheckCircle /></button>}
                      {isOpenBill(b) && <button className="btn btn-sm btn-outline-warning" onClick={()=>handleBalanceReminder(b.id)} title="Send balance reminder"><FiBell /></button>}
                      {b.status==='unpaid' && <button className="btn btn-sm btn-outline-danger" onClick={()=>handleDelete(b.id)} title={t.delete}><FiTrash2 /></button>}
                    </div>
                  </div>
                ))}
                {completedFiltered.length===0 && <div style={{ textAlign:'center', color:'var(--text-muted)', padding:'36px 0', fontSize:'0.88rem' }}>{t.noCompletedEntries}</div>}
              </div>
              {/* Desktop table */}
              <div className="d-none d-md-block table-responsive">
                <table className="table table-hover mb-0">
                  <thead><tr><th>{t.invoice}</th><th>{t.subscriber}</th><th>{t.meterNum}</th><th>{t.reading}</th><th>{t.kwhUsed}</th><th>{t.totalTTC}</th><th>{t.status}</th><th>{t.actions}</th></tr></thead>
                  <tbody>
                    {paged.map(({subscriber:s,bill:b})=>(
                      <tr key={b.id}>
                        <td><code>{b.invoice_number}</code></td>
                        <td style={{ fontWeight:500 }}>{s.full_name}</td>
                        <td><code>{s.meter_number||'—'}</code></td>
                        <td style={{ fontSize:'0.8rem', color:'var(--text-sub)' }}>
                          {b.prev_reading!=null && b.current_reading!=null
                            ? `${Number(b.prev_reading).toLocaleString(undefined,{maximumFractionDigits:2})} → ${Number(b.current_reading).toLocaleString(undefined,{maximumFractionDigits:2})}`
                            : '—'}
                        </td>
                        <td>{Number(b.kwh_used||0).toLocaleString(undefined,{maximumFractionDigits:2})}</td>
                        <td style={{ fontWeight:600 }}>
                          {fmtBillDual(b, fallbackUsdRate)}
                          <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:3 }}>
                            {t.billLabel || 'Bill'}: {fmtSignedDual(resolveBillUsd(b, fallbackUsdRate), Number(b.total_ttc_lbp || 0))}
                          </div>
                          <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
                            {t.previousBalance || 'Previous balance'}: {fmtSignedDual(Number(b.previous_balance_usd || 0), Number(b.previous_balance_lbp || 0))}
                          </div>
                          <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
                            {t.carryNext || 'Carry next'}: {fmtSignedDual(Number(b.remaining_balance_usd || 0), Number(b.remaining_balance_lbp || 0))}
                          </div>
                          {Number(b.is_fixed_amount) === 1 && (
                            <div style={{ fontSize:'0.72rem', color:'var(--accent)' }}>
                              {t.fixedBill || 'Fixed bill'}: ${Number(b.fixed_amount_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </div>
                          )}
                        </td>
                        <td><span className={`badge-${b.status}`}>{t[b.status]||b.status}</span></td>
                        <td>
                          <div style={{ display:'flex', gap:4 }}>
                            <button className="btn btn-sm btn-outline-success" onClick={()=>handleWhatsAppBill({ subscriber:s, bill:b })} title="WhatsApp">
                              <FiMessageCircle />
                            </button>
                            <button className="btn btn-sm btn-outline-primary" onClick={()=>handlePrintInvoice(b.id)} title={t.printInvoice}><FiPrinter /></button>
                            {isOpenBill(b) && <button className="btn btn-sm btn-outline-success" onClick={()=>openPaymentModal({ subscriber:s, bill:b })} title={t.markPaid}><FiCheckCircle /></button>}
                            {isOpenBill(b) && <button className="btn btn-sm btn-outline-warning" onClick={()=>handleBalanceReminder(b.id)} title="Send balance reminder"><FiBell /></button>}
                            {b.status==='unpaid' && <button className="btn btn-sm btn-outline-danger" onClick={()=>handleDelete(b.id)} title={t.delete}><FiTrash2 /></button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {completedFiltered.length===0 && <tr><td colSpan={8} style={{ textAlign:'center', color:'var(--text-muted)', padding:'32px', fontSize:'0.85rem' }}>{t.noCompletedEntries}</td></tr>}
                  </tbody>
                </table>
              </div>
              <PaginationBar />
            </>
          )}
        </div>
      )}

      {/* Pricing */}
      {activeSection==='pricing' && (
        <div className="table-card">
          <div className="card-header-row">
            <span className="card-title">{t.planPricing} — {MONTHS[period.month]} {period.year}</span>
          </div>
          <div style={{ padding:'8px 14px', fontSize:'0.78rem', color:'var(--text-muted)', borderBottom:'1px solid var(--border)' }}>{t.pricingRuleDesc}</div>
          {loading ? <div style={{ display:'flex', justifyContent:'center', padding:'32px 0' }}><div className="spinner-border" /></div> : (
            <>
              {/* Mobile pricing cards */}
              <div className="d-lg-none" style={{ padding:'8px 10px' }}>
                {paged.map(row=>{
                  const draft = pricingDrafts[row.plan_id]||{};
                  const sk = row.pricing_source||(row.is_custom?'period_custom':'default');
                  const srcLabel = sk==='period_custom' ? t.custom : sk==='carry_forward' ? `${MONTHS_EN[row.source_month]||''} ${row.source_year||''}`.trim() : t.default;
                  return (
                    <div className="data-card" key={row.plan_id}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                        <div>
                          <div className="data-card-title">{row.plan_name} ({row.ampere}A)</div>
                          <div className="data-card-sub">{row.generator_name} · <span className={sk==='period_custom'?'badge-waived':sk==='carry_forward'?'badge-unpaid':'badge-default-src'}>{srcLabel}</span></div>
                        </div>
                      </div>
                      <div className="row g-2">
                        {[
                          ['Threshold kWh', 'threshold_kwh', 70],
                          ['≤ Threshold (LBP)', 'base_cost_below_lbp', 100],
                          ['> Threshold (LBP)', 'base_cost_above_lbp', 100],
                          ['Maint. (LBP)', 'maintenance_lbp', 100],
                        ].map(([label, field, w])=>(
                          <div className="col-6" key={field}>
                            <label style={{ fontSize:'0.68rem', color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:3 }}>{label}</label>
                            <input type="number" className="form-control form-control-sm" value={draft[field]??''} onChange={e=>handlePricingChange(row.plan_id,field,e.target.value)} min={0} step={field==='threshold_kwh'?1:0.01} />
                          </div>
                        ))}
                      </div>
                      <div style={{ display:'flex', gap:6, marginTop:10 }}>
                        <button className="btn btn-sm btn-outline-primary" onClick={()=>handleSavePricing(row.plan_id)} disabled={savingPricingPlanId===row.plan_id}><FiSave /> Save</button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={()=>handleResetPricing(row.plan_id)} disabled={savingPricingPlanId===row.plan_id}><FiRefreshCw /> Reset</button>
                      </div>
                    </div>
                  );
                })}
                {planPricing.length===0 && <div style={{ textAlign:'center', color:'var(--text-muted)', padding:'36px 0', fontSize:'0.88rem' }}>{t.noPlansFound}</div>}
              </div>
              {/* Desktop pricing table */}
              <div className="d-none d-lg-block table-responsive">
                <table className="table table-hover mb-0">
                  <thead><tr><th>{t.generator}</th><th>{t.plan}</th><th>{t.thresholdKwh}</th><th>{t.baseBelowThreshold}</th><th>{t.baseAboveThreshold}</th><th>{t.maintenanceLBP}</th><th>{t.source}</th><th>{t.actions}</th></tr></thead>
                  <tbody>
                    {paged.map(row=>{
                      const draft = pricingDrafts[row.plan_id]||{};
                      const sk = row.pricing_source||(row.is_custom?'period_custom':'default');
                      const srcLabel = sk==='period_custom' ? t.custom : sk==='carry_forward' ? `${MONTHS_EN[row.source_month]||''} ${row.source_year||''}`.trim() : t.default;
                      const srcClass = sk==='period_custom' ? 'badge-waived' : sk==='carry_forward' ? 'badge-unpaid' : 'badge-default-src';
                      return (
                        <tr key={row.plan_id}>
                          <td>{row.generator_name}</td>
                          <td style={{ fontWeight:500 }}>{row.plan_name} ({row.ampere}A)</td>
                          <td><input type="number" className="form-control form-control-sm" style={{ width:76 }} min={1} step={1} value={draft.threshold_kwh??''} onChange={e=>handlePricingChange(row.plan_id,'threshold_kwh',e.target.value)} /></td>
                          <td><input type="number" className="form-control form-control-sm" style={{ width:110 }} min={0} step={0.01} value={draft.base_cost_below_lbp??''} onChange={e=>handlePricingChange(row.plan_id,'base_cost_below_lbp',e.target.value)} /></td>
                          <td><input type="number" className="form-control form-control-sm" style={{ width:110 }} min={0} step={0.01} value={draft.base_cost_above_lbp??''} onChange={e=>handlePricingChange(row.plan_id,'base_cost_above_lbp',e.target.value)} /></td>
                          <td><input type="number" className="form-control form-control-sm" style={{ width:100 }} min={0} step={0.01} value={draft.maintenance_lbp??''} onChange={e=>handlePricingChange(row.plan_id,'maintenance_lbp',e.target.value)} /></td>
                          <td><span className={srcClass}>{srcLabel}</span></td>
                          <td>
                            <div style={{ display:'flex', gap:4 }}>
                              <button className="btn btn-sm btn-outline-primary" onClick={()=>handleSavePricing(row.plan_id)} disabled={savingPricingPlanId===row.plan_id}><FiSave /></button>
                              <button className="btn btn-sm btn-outline-secondary" onClick={()=>handleResetPricing(row.plan_id)} disabled={savingPricingPlanId===row.plan_id}><FiRefreshCw /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {planPricing.length===0 && <tr><td colSpan={8} style={{ textAlign:'center', color:'var(--text-muted)', padding:'32px', fontSize:'0.85rem' }}>{t.noPlansFound}</td></tr>}
                  </tbody>
                </table>
              </div>
              <PaginationBar />
            </>
          )}
        </div>
      )}

      <Modal show={showPaymentModal} onHide={()=>setShowPaymentModal(false)}>
        <Modal.Header closeButton><Modal.Title>{t.recordPayment || 'Record Payment'}</Modal.Title></Modal.Header>
        <Modal.Body>
          <form id="ownerBillPaymentForm" onSubmit={handleSubmitPayment}>
            <div style={{ background:'var(--bg3)', borderRadius:'var(--radius-sm)', padding:'12px', marginBottom:14 }}>
              <div style={{ fontWeight:600, color:'var(--text)' }}>{selectedPaymentRow?.subscriber?.full_name}</div>
              <div style={{ fontSize:'0.8rem', color:'var(--text-sub)', marginTop:2 }}>
                {selectedPaymentRow?.bill ? `${MONTHS[Number(selectedPaymentRow.bill.month) || period.month]} ${selectedPaymentRow.bill.year}` : ''}
              </div>
              <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginTop:6 }}>
                {t.currentBill || 'Current bill'}: <strong style={{ color:'var(--text)' }}>
                  {selectedPaymentRow?.bill ? fmtSignedDual(resolveBillUsd(selectedPaymentRow.bill, fallbackUsdRate), Number(selectedPaymentRow.bill.total_ttc_lbp || 0)) : '-'}
                </strong>
              </div>
              <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginTop:4 }}>
                {t.previousBalance || 'Previous balance'}: <strong style={{ color:'var(--text)' }}>
                  {selectedPaymentRow?.bill ? fmtSignedDual(Number(selectedPaymentRow.bill.previous_balance_usd || 0), Number(selectedPaymentRow.bill.previous_balance_lbp || 0)) : '-'}
                </strong>
              </div>
              <div style={{ fontSize:'0.82rem', color:'var(--accent)', marginTop:6 }}>
                {t.amountDue || 'Amount due'}: {selectedPaymentRow?.bill ? fmtBillDual(selectedPaymentRow.bill, fallbackUsdRate) : '-'}
              </div>
            </div>
            <div>
              <label className="form-label">{t.amountReceivedUsd || 'Amount received (USD)'}</label>
              <input
                type="number"
                className="form-control"
                value={paymentAmountUsd}
                onChange={(e)=>setPaymentAmountUsd(e.target.value)}
                min={0}
                step={0.01}
                required
                autoFocus
              />
              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:4 }}>
                {t.paymentCarryForwardHelp || 'Overpayment becomes credit on the next bill. Underpayment becomes carry balance on the next bill.'}
              </div>
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={()=>setShowPaymentModal(false)}>{t.cancel}</button>
          <button type="submit" form="ownerBillPaymentForm" className="btn btn-primary" disabled={savingPayment}>
            {savingPayment ? t.loading : (t.markPaid || 'Save Payment')}
          </button>
        </Modal.Footer>
      </Modal>

      {/* Entry Modal */}
      <Modal show={showEntryModal} onHide={()=>setShowEntryModal(false)}>
        <Modal.Header closeButton><Modal.Title>{t.enterNewMeterReading}</Modal.Title></Modal.Header>
        <Modal.Body>
          <form id="kwhEntryForm" onSubmit={handleSubmitEntry}>
            <div style={{ background:'var(--bg3)', borderRadius:'var(--radius-sm)', padding:'12px', marginBottom:14 }}>
              <div style={{ fontWeight:600, color:'var(--text)' }}>{selectedSubscriber?.full_name}</div>
              <div style={{ fontSize:'0.8rem', color:'var(--text-sub)', marginTop:2 }}>{MONTHS[period.month]} {period.year}</div>
              <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginTop:4 }}>
                {t.lastReading}: <strong style={{ color:'var(--text)' }}>
                  {readingContext.loading
                    ? t.loading
                    : Number(readingContext?.previousValue ?? 0).toLocaleString(undefined,{maximumFractionDigits:2})}
                </strong>
              </div>
              {hasLockedNewReading && (
                <div style={{ fontSize:'0.8rem', color:'var(--warning)', marginTop:6 }}>
                  {t.backdatedPeriodDetected || 'Backdated period detected. New reading is fixed to'}{' '}
                  {Number(readingContext.lockedNewReading).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  {' '}{t.continuityWithFollowingMonth || 'to keep continuity with the following month.'}
                </div>
              )}
              {isSelectedFixedAmount && (
                <div style={{ fontSize:'0.8rem', color:'var(--accent)', marginTop:6 }}>
                  {t.fixedBillActiveNotice || 'Fixed bill active'}: ${selectedFixedAmountUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })} ({t.vatDisabledMeterReadingOptional || 'VAT disabled. Meter reading is optional.'})
                </div>
              )}
            </div>
            <div className="mb-3">
              <label className="form-label">
                {t.prevReading}
              </label>
              <input
                type="number"
                className="form-control"
                value={entryForm.previous_reading}
                onChange={e=>setEntryForm(f=>({...f,previous_reading:e.target.value}))}
                min={0}
                step={0.01}
                disabled={readingContext.loading}
                autoFocus
              />
              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:4 }}>
                {t.backdatedPreviousReadingHelp || 'You can adjust old reading manually when entering backdated bills.'}
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">
                {t.newMeterReading} {(!isSelectedFixedAmount || hasLockedNewReading) ? '*' : ''}
              </label>
              <input
                type="number"
                className="form-control"
                value={entryForm.new_meter_reading}
                onChange={e=>setEntryForm(f=>({...f,new_meter_reading:e.target.value}))}
                min={0}
                step={0.01}
                required={!isSelectedFixedAmount || hasLockedNewReading}
                disabled={readingContext.loading || hasLockedNewReading}
              />
              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:4 }}>
                {hasLockedNewReading
                  ? (t.lockedByNextMonthReading || 'This value is locked by the next month reading history.')
                  : isSelectedFixedAmount
                  ? (t.optionalReadingForTracking || 'Optional: enter reading only if you want to keep kWh tracking.')
                  : t.kwhAutoCalc}
              </div>
            </div>
            <div>
              <label className="form-label">{t.notes}</label>
              <textarea className="form-control" rows={2} value={entryForm.notes} onChange={e=>setEntryForm(f=>({...f,notes:e.target.value}))} />
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={()=>setShowEntryModal(false)}>{t.cancel}</button>
          <button type="submit" form="kwhEntryForm" className="btn btn-primary" disabled={savingEntry}>
            {savingEntry ? t.loading : t.saveReading}
          </button>
        </Modal.Footer>
      </Modal>

    </div>
  );
}
