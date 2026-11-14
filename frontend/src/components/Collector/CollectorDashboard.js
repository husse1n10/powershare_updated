import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCamera, FiCreditCard, FiFileText, FiUsers, FiDollarSign, FiClock, FiArrowRight } from 'react-icons/fi';
import api from '../../services/api';
import { useLang } from '../../contexts/LangContext';
import { formatDateTimeUtcPlus2 } from '../../utils/timezone';

function fmtLbp(value) {
  return `${Number(value || 0).toLocaleString()} LBP`;
}

function statusClass(status) {
  if (status === 'confirmed' || status === 'paid') return 'badge-active';
  if (status === 'rejected') return 'badge-inactive';
  return 'badge-pending';
}

export default function CollectorDashboard() {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardRes, walletRes] = await Promise.all([
        api.get('/collector/dashboard'),
        api.get('/collector/wallet'),
      ]);
      setData(dashboardRes.data || {});
      setWallet(walletRes.data || {});
      setMsg(null);
    } catch (err) {
      setMsg({ type: 'danger', text: err.response?.data?.error || t.failed || 'Failed to load collector dashboard.' });
    } finally {
      setLoading(false);
    }
  }, [t.failed]);

  useEffect(() => { load(); }, [load]);

  const pendingSettlement = useMemo(
    () => (data?.recent_settlements || []).filter(x => x.status === 'pending').reduce((sum, row) => sum + Number(row.amount_lbp || 0), 0),
    [data]
  );

  if (loading) {
    return <div className="d-flex justify-content-center py-5"><div className="spinner-border" /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h4 className="page-title mb-1">{t.collectorDashboard || 'Collector Dashboard'}</h4>
          <div className="text-muted small">{data?.collector?.full_name || ''}</div>
        </div>
        <button type="button" className="btn btn-outline-primary" onClick={load}>{t.refresh || 'Refresh'}</button>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-3"><div className="stat-card h-100"><div className="stat-icon"><FiUsers /></div><div><div className="stat-value">{Number(data?.assigned_subscribers || 0).toLocaleString()}</div><div className="stat-label">{t.assignedSubscribers || 'Assigned Subscribers'}</div></div></div></div>
        <div className="col-6 col-xl-3"><div className="stat-card h-100"><div className="stat-icon"><FiFileText /></div><div><div className="stat-value">{Number(data?.bills_to_collect || 0).toLocaleString()}</div><div className="stat-label">{t.billsToCollect || 'Bills to Collect'}</div></div></div></div>
        <div className="col-6 col-xl-3"><div className="stat-card h-100"><div className="stat-icon"><FiDollarSign /></div><div><div className="stat-value stat-value-money">{fmtLbp(wallet?.available_lbp ?? data?.balance_lbp)}</div><div className="stat-label">{t.availableBalance || 'Available Balance'}</div></div></div></div>
        <div className="col-6 col-xl-3"><div className="stat-card h-100"><div className="stat-icon"><FiClock /></div><div><div className="stat-value stat-value-money">{fmtLbp(pendingSettlement)}</div><div className="stat-label">{t.pendingSettlements || 'Pending Settlements'}</div></div></div></div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4"><Link to="/collector/meter-scan" className="quick-action-card"><span className="quick-action-icon"><FiCamera /></span><span><b>{t.meterScan || 'Meter Scan'}</b><small>{t.scanAndRecord || 'Scan a meter and record its reading'}</small></span><FiArrowRight className="quick-action-arrow" /></Link></div>
        <div className="col-md-4"><Link to="/collector/bills" className="quick-action-card"><span className="quick-action-icon"><FiCreditCard /></span><span><b>{t.collectPayments || 'Collect Payments'}</b><small>{t.openBillsWallet || 'Open bills, wallet and settlements'}</small></span><FiArrowRight className="quick-action-arrow" /></Link></div>
        <div className="col-md-4"><Link to="/collector/settings" className="quick-action-card"><span className="quick-action-icon"><FiUsers /></span><span><b>{t.profileSettings || 'Profile Settings'}</b><small>{t.updatePersonalInfo || 'Update your personal information'}</small></span><FiArrowRight className="quick-action-arrow" /></Link></div>
      </div>

      <div className="row g-3">
        <div className="col-xl-7">
          <div className="table-card h-100">
            <div className="card-header-row"><span className="card-title">{t.recentBills || 'Recent Bills'}</span><Link to="/collector/bills" className="btn btn-sm btn-outline-primary">{t.viewAll || 'View All'}</Link></div>
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead><tr><th>{t.subscriber || 'Subscriber'}</th><th>{t.invoice || 'Invoice'}</th><th>{t.period || 'Period'}</th><th>{t.status || 'Status'}</th><th>{t.amountDue || 'Amount Due'}</th></tr></thead>
                <tbody>
                  {(data?.recent_bills || []).map(b => <tr key={b.id}><td><b>{b.subscriber_name || '-'}</b></td><td>{b.invoice_number || `#${b.id}`}</td><td>{b.month}/{b.year}</td><td><span className={statusClass(b.status)}>{b.status}</span></td><td>{fmtLbp(b.amount_due_lbp ?? b.remaining_balance_lbp ?? b.total_ttc_lbp)}</td></tr>)}
                  {!(data?.recent_bills || []).length && <tr><td colSpan="5" className="text-center text-muted p-4">{t.noBillsFound || 'No bills found'}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-xl-5">
          <div className="table-card h-100">
            <div className="card-header-row"><span className="card-title">{t.recentSettlements || 'Recent Settlements'}</span></div>
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead><tr><th>{t.date || 'Date'}</th><th>{t.amount || 'Amount'}</th><th>{t.status || 'Status'}</th></tr></thead>
                <tbody>
                  {(data?.recent_settlements || []).map(s => <tr key={s.id}><td>{formatDateTimeUtcPlus2(s.created_at)}</td><td>{fmtLbp(s.amount_lbp)}</td><td><span className={statusClass(s.status)}>{s.status}</span></td></tr>)}
                  {!(data?.recent_settlements || []).length && <tr><td colSpan="3" className="text-center text-muted p-4">{t.noSettlementRequestsYet || 'No settlement requests yet'}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
