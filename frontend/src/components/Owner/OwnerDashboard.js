import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useLang } from '../../contexts/LangContext';
import { FiZap, FiUsers, FiDollarSign, FiAlertCircle } from 'react-icons/fi';
import { MONTHS_EN, MONTHS_AR } from '../../i18n';

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

export default function OwnerDashboard() {
  const { t, lang } = useLang();
  const MONTHS = lang === 'ar' ? MONTHS_AR : MONTHS_EN;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { const res = await api.get('/owner/dashboard'); setData(res.data); }
    catch (_) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'50vh' }}>
      <div className="spinner-border" />
    </div>
  );
  if (!data) return <div className="alert alert-danger">Failed to load dashboard</div>;

  const usdRate = Number(data.usd_lbp_rate || 89700);
  const stats = [
    { label:t.totalGenerators,   value:data.total_generators,   color:'var(--accent)',  bg:'var(--accent-light)', icon:<FiZap /> },
    { label:t.activeSubscribers, value:data.active_subscribers, color:'var(--success)', bg:'var(--success-bg)',   icon:<FiUsers /> },
    {
      label:t.collected,
      value:fmtDualCurrency(data.total_collected_lbp, usdRate, data.total_collected_usd),
      color:'var(--success)',
      bg:'var(--success-bg)',
      icon:<FiDollarSign />,
    },
    {
      label:t.pending,
      value:fmtDualCurrency(data.total_pending_lbp, usdRate, data.total_pending_usd),
      color:'var(--warning)',
      bg:'var(--warning-bg)',
      icon:<FiAlertCircle />,
    },
  ];

  return (
    <div>
      <div className="page-header"><h4 className="page-title">{t.dashboard}</h4></div>

      <div className="row g-3 mb-4">
        {stats.map(s => (
          <div className="col-6 col-md-3" key={s.label}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background:s.bg, color:s.color }}>{s.icon}</div>
              <div className="stat-value" style={{ color:s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-7">
          <div className="table-card">
            <div className="card-header-row"><span className="card-title">{t.recentBills}</span></div>

            {/* Mobile cards */}
            <div className="d-lg-none" style={{ padding:'8px 10px' }}>
              {(data.recentBills||[]).map(b => (
                <div className="data-card" key={b.id}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                    <div style={{ minWidth:0 }}>
                      <div className="data-card-title" style={{ fontSize:'0.84rem' }}>{b.subscriber_name}</div>
                      <code style={{ fontSize:'0.72rem' }}>{b.invoice_number}</code>
                    </div>
                    <span className={`badge-${b.status}`}>{t[b.status]||b.status}</span>
                  </div>
                  <div className="data-card-row">
                    <span style={{ fontWeight:700, color:'var(--text)' }}>
                      {fmtDualCurrency(b.total_ttc_lbp, b.usd_lbp_rate || usdRate, b.total_usd)}
                    </span>
                    <span style={{ fontSize:'0.76rem', color:'var(--text-muted)' }}>{MONTHS[b.month]} {b.year}</span>
                  </div>
                </div>
              ))}
              {!data.recentBills?.length && (
                <div style={{ textAlign:'center', color:'var(--text-muted)', padding:'24px 0', fontSize:'0.85rem' }}>{t.noData}</div>
              )}
            </div>

            {/* Desktop table */}
            <div className="d-none d-lg-block table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr><th>{t.invoice}</th><th>{t.subscriber}</th><th>{t.period}</th><th>{t.amountTTC}</th><th>{t.status}</th></tr>
                </thead>
                <tbody>
                  {(data.recentBills||[]).map(b => (
                    <tr key={b.id}>
                      <td><code>{b.invoice_number}</code></td>
                      <td style={{ fontWeight:500 }}>{b.subscriber_name}</td>
                      <td style={{ fontSize:'0.84rem' }}>{MONTHS[b.month]} {b.year}</td>
                      <td style={{ fontWeight:600 }}>
                        {fmtDualCurrency(b.total_ttc_lbp, b.usd_lbp_rate || usdRate, b.total_usd)}
                      </td>
                      <td><span className={`badge-${b.status}`}>{t[b.status]||b.status}</span></td>
                    </tr>
                  ))}
                  {!data.recentBills?.length && (
                    <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--text-muted)', padding:'24px', fontSize:'0.84rem' }}>{t.noData}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-5">
          <div className="table-card">
            <div className="card-header-row"><span className="card-title">{t.generatorSummary}</span></div>

            {/* Mobile cards */}
            <div className="d-lg-none" style={{ padding:'8px 10px' }}>
              {(data.generatorStats||[]).map(g => (
                <div className="data-card" key={g.id}>
                  <div className="data-card-title">{g.name}</div>
                  <div className="data-card-row">
                    <span>{t.subscriberCount}: <strong style={{ color:'var(--text)' }}>{g.subscribers}</strong></span>
                    <span style={{ fontWeight:700, color:'var(--text)' }}>
                      {fmtDualCurrency(g.revenue_lbp, usdRate, g.revenue_usd)}
                    </span>
                  </div>
                </div>
              ))}
              {!data.generatorStats?.length && (
                <div style={{ textAlign:'center', color:'var(--text-muted)', padding:'24px 0', fontSize:'0.85rem' }}>{t.noData}</div>
              )}
            </div>

            {/* Desktop table */}
            <div className="d-none d-lg-block table-responsive">
              <table className="table mb-0">
                <thead>
                  <tr><th>{t.generator}</th><th>{t.subscriberCount}</th><th>{t.revenue}</th></tr>
                </thead>
                <tbody>
                  {(data.generatorStats||[]).map(g => (
                    <tr key={g.id}>
                      <td style={{ fontWeight:500 }}>{g.name}</td>
                      <td>{g.subscribers}</td>
                      <td style={{ fontWeight:600 }}>{fmtDualCurrency(g.revenue_lbp, usdRate, g.revenue_usd)}</td>
                    </tr>
                  ))}
                  {!data.generatorStats?.length && (
                    <tr><td colSpan={3} style={{ textAlign:'center', color:'var(--text-muted)', padding:'24px', fontSize:'0.84rem' }}>{t.noData}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
