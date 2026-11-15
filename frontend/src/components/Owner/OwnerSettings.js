import { ownerSettingsPayload } from '../../utils/ownerSettings';
import { PASSWORD_PATTERN } from '../../utils/passwordPolicy';
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useLang } from '../../contexts/LangContext';
import { useAuth } from '../../contexts/AuthContext';
import { FiSave, FiUser, FiBriefcase, FiSettings, FiFileText } from 'react-icons/fi';
const DEFAULT_INVOICE_TEXT = {
  invoice_title: '\u0641\u0627\u062A\u0648\u0631\u0629',
  invoice_recipient_prefix: '\u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0645\u0646',
  invoice_item_label: '\u0627\u0644\u0635\u0646\u0641',
  invoice_old_label: '\u0642\u062F\u064A\u0645',
  invoice_new_label: '\u062C\u062F\u064A\u062F',
  invoice_usage_label: '\u0627\u0633\u062A\u0647\u0644\u0627\u0643',
  invoice_price_label: '\u0627\u0644\u0633\u0639\u0631',
  invoice_total_label: '\u0627\u0644\u0645\u062C\u0645\u0648\u0639 \u0627\u0644\u0639\u0627\u0645',
  invoice_issue_date_label: '\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0635\u062F\u0627\u0631',
  invoice_period_label: '\u0648\u0630\u0644\u0643 \u0639\u0646 \u0634\u0647\u0631',
  invoice_area_label: '\u0627\u0644\u0645\u0646\u0637\u0642\u0629',
  invoice_address_label: '\u0627\u0644\u0639\u0646\u0648\u0627\u0646',
  invoice_phone_label: '\u0647\u0627\u062A\u0641',
  invoice_meter_label: '\u0631\u0642\u0645 \u0627\u0644\u0639\u062F\u0627\u062F'
};
function fmt(n) {
  return Number(n || 0).toLocaleString();
}
function SectionCard({
  icon,
  title,
  children,
  onApply,
  applying,
  disabled,
  applyLabel,
  savingLabel
}) {
  return <div className="table-card mb-4" style={{
    overflow: 'visible'
  }}>
      <div className="card-header-row">
        <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
          <span style={{
          color: 'var(--accent)'
        }}>{icon}</span>
          <span className="card-title">{title}</span>
        </div>
        {onApply && <button type="button" className="btn btn-sm btn-outline-primary" onClick={onApply} disabled={disabled} style={{
        minWidth: 118,
        justifyContent: 'center'
      }}>
            {applying ? <><span className="spinner-border spinner-border-sm" style={{
            marginRight: 8
          }} />{savingLabel}</> : <><FiSave style={{
            marginRight: 6
          }} />{applyLabel}</>}
          </button>}
      </div>
      <div style={{
      padding: '18px'
    }}>{children}</div>
    </div>;
}
export default function OwnerSettings() {
  const {
    t
  } = useLang();
  const {
    reloadUser
  } = useAuth();
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    phone: '',
    password: '',
    phone2: '',
    business_name: '',
    company_name: '',
    company_address: '',
    company_street: '',
    company_city: '',
    capital_lbp: '',
    fiscal_number: '',
    registry_number: '',
    vat_rate: 11,
    vat_enabled: 1,
    usd_lbp_rate: 89700,
    invoice_prefix: 'SLK',
    ...DEFAULT_INVOICE_TEXT,
    notes: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSection, setSavingSection] = useState('');
  const [msg, setMsg] = useState(null);
  const load = useCallback(async () => {
    try {
      const res = await api.get('/owner/settings');
      setForm(prev => ({
        ...prev,
        ...DEFAULT_INVOICE_TEXT,
        ...res.data
      }));
    } catch (err) {
      setMsg({
        type: 'danger',
        text: err.response?.data?.error || 'Failed to load'
      });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const handleChange = e => {
    const {
      name,
      value,
      type,
      checked
    } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === 'checkbox' ? checked ? 1 : 0 : value
    }));
  };
  const saveSettings = async (sectionKey = '') => {
    setSaving(true);
    setSavingSection(sectionKey);
    try {
      if (sectionKey === 'personal') {
        await api.put('/auth/profile', {
          full_name: form.full_name,
          username: form.username,
          phone: form.phone,
          password: form.password
        });
        setForm(f => ({
          ...f,
          password: ''
        }));
        await reloadUser();
      } else {
        await api.put('/owner/settings', ownerSettingsPayload(form, sectionKey));
      }
      setMsg({
        type: 'success',
        text: 'Settings saved.'
      });
    } catch (err) {
      setMsg({
        type: 'danger',
        text: err.response?.data?.error || 'Failed to save'
      });
    } finally {
      setSaving(false);
      setSavingSection('');
    }
  };
  const handleSubmit = async e => {
    e.preventDefault();
    if (saving) return;
    await saveSettings('');
  };
  const applyLabel = t.saveChanges || t.save;
  const savingLabel = 'Saving...';
  const previewBase = 2191320;
  const previewMaint = 685000;
  const previewHt = previewBase + previewMaint;
  const previewVat = form.vat_enabled ? Math.round(previewHt * (Number(form.vat_rate) || 11) / 100) : 0;
  const previewTtc = previewHt + previewVat;
  const previewUsd = Number(form.usd_lbp_rate) > 0 ? (previewTtc / Number(form.usd_lbp_rate)).toFixed(2) : '0.00';
  if (loading) return <div style={{
    display: 'flex',
    justifyContent: 'center',
    padding: '40px 0'
  }}><div className="spinner-border" /></div>;
  return <div>
      <div className="page-header">
        <h4 className="page-title">{t.settings}</h4>
      </div>

      {msg && <div className={`alert alert-${msg.type} alert-dismissible mb-3`}>{msg.text}<button className="btn-close" onClick={() => setMsg(null)}>✕</button></div>}

      <form onSubmit={handleSubmit}>
        <SectionCard icon={<FiUser />} title={t.personalInfo} onApply={() => saveSettings('personal')} applying={saving && savingSection === 'personal'} disabled={saving} applyLabel={applyLabel} savingLabel={savingLabel}>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">{t.fullName} *</label>
              <input className="form-control" name="full_name" value={form.full_name || ''} onChange={handleChange} required autoFocus />
            </div>
            <div className="col-md-4">
              <label className="form-label">{t.username || 'Username'} *</label>
              <input className="form-control" name="username" value={form.username || ''} onChange={handleChange} required minLength={3} pattern="[A-Za-z0-9_.-]+" />
            </div>
            <div className="col-md-4">
              <label className="form-label">{t.phone}</label>
              <input className="form-control" name="phone" value={form.phone || ''} onChange={handleChange} placeholder="+961XXXXXXXX" pattern="[+]961[0-9]{6,10}" title="Must start with +961" />
            </div>
            <div className="col-md-4">
              <label className="form-label">{t.password || 'Password'}</label>
              <input type="password" className="form-control" name="password" value={form.password || ''} onChange={handleChange} minLength={8} pattern={PASSWORD_PATTERN} title="At least 8 characters: uppercase, lowercase, number and symbol" placeholder="Use Password & Security page" disabled maxLength={72} />
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={<FiBriefcase />} title={t.businessInfo} onApply={() => saveSettings('business')} applying={saving && savingSection === 'business'} disabled={saving} applyLabel={applyLabel} savingLabel={savingLabel}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">{t.companyName}</label>
              <input className="form-control" name="company_name" value={form.company_name || ''} onChange={handleChange} />
            </div>
            <div className="col-md-6">
              <label className="form-label">{t.businessName}</label>
              <input className="form-control" name="business_name" value={form.business_name || ''} onChange={handleChange} />
            </div>
            <div className="col-md-6">
              <label className="form-label">{t.street}</label>
              <input className="form-control" name="company_street" value={form.company_street || ''} onChange={handleChange} />
            </div>
            <div className="col-md-6">
              <label className="form-label">{t.city}</label>
              <input className="form-control" name="company_city" value={form.company_city || ''} onChange={handleChange} />
            </div>
            <div className="col-md-4">
              <label className="form-label">{t.capitalLBP}</label>
              <input type="number" className="form-control" name="capital_lbp" value={form.capital_lbp || ''} onChange={handleChange} min={0} />
            </div>
            <div className="col-md-4">
              <label className="form-label">{t.fiscalNumber}</label>
              <input className="form-control" name="fiscal_number" value={form.fiscal_number || ''} onChange={handleChange} />
            </div>
            <div className="col-md-4">
              <label className="form-label">{t.registryNumber}</label>
              <input className="form-control" name="registry_number" value={form.registry_number || ''} onChange={handleChange} />
            </div>
            <div className="col-md-4">
              <label className="form-label">{t.phone2}</label>
              <input className="form-control" name="phone2" value={form.phone2 || ''} onChange={handleChange} placeholder="+961XXXXXXXX" pattern="[+]961[0-9]{6,10}" title="Must start with +961" />
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={<FiSettings />} title={t.billingConfig} onApply={() => saveSettings('billing')} applying={saving && savingSection === 'billing'} disabled={saving} applyLabel={applyLabel} savingLabel={savingLabel}>
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label">{t.invoicePrefix}</label>
              <input className="form-control" name="invoice_prefix" value={form.invoice_prefix || ''} onChange={handleChange} maxLength={10} />
            </div>
            <div className="col-md-3">
              <label className="form-label">{t.usdLbpRate}</label>
              <input type="number" className="form-control" name="usd_lbp_rate" value={form.usd_lbp_rate || ''} onChange={handleChange} step="0.01" min="1" />
            </div>
            <div className="col-md-3" style={{
            display: 'flex',
            alignItems: 'flex-end',
            paddingBottom: 2
          }}>
              <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              color: 'var(--text)',
              fontSize: '0.88rem',
              fontWeight: 500
            }}>
                <input type="checkbox" name="vat_enabled" checked={!!form.vat_enabled} onChange={handleChange} style={{
                width: 16,
                height: 16,
                accentColor: 'var(--accent)'
              }} />
                {t.vatEnabled}
              </label>
            </div>
            {!!form.vat_enabled && <div className="col-md-3">
                <label className="form-label">{t.vatRate}</label>
                <input type="number" className="form-control" name="vat_rate" value={form.vat_rate || 11} onChange={handleChange} step="0.01" min={0} max={100} />
              </div>}
          </div>
          {/* Preview */}
          <div style={{
          marginTop: 16,
          background: 'var(--bg3)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '14px'
        }}>
            <div style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            marginBottom: 10
          }}>INVOICE PREVIEW</div>
            <table style={{
            fontSize: '0.83rem',
            borderSpacing: '0 4px',
            borderCollapse: 'separate'
          }}>
              <tbody>
                {[['Base Amount', fmt(previewBase) + ' LBP'], ['Maintenance', fmt(previewMaint) + ' LBP'], ['TOTAL H.T', fmt(previewHt) + ' LBP', true], ...(form.vat_enabled ? [[`VAT ${form.vat_rate}%`, fmt(previewVat) + ' LBP']] : []), ['TOTAL T.T.C', fmt(previewTtc) + ' LBP', true], [`USD (${fmt(form.usd_lbp_rate)} LBP)`, previewUsd + ' USD']].map(([label, val, bold]) => <tr key={label}>
                    <td style={{
                  paddingRight: 24,
                  color: bold ? 'var(--text)' : 'var(--text-sub)',
                  fontWeight: bold ? 700 : 400
                }}>{label}</td>
                    <td style={{
                  fontWeight: bold ? 700 : 500,
                  color: bold ? 'var(--accent)' : 'var(--text)'
                }}>{val}</td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard icon={<FiFileText />} title={t.invoiceLabels} onApply={() => saveSettings('invoice_labels')} applying={saving && savingSection === 'invoice_labels'} disabled={saving} applyLabel={applyLabel} savingLabel={savingLabel}>
          <div className="row g-3">
            {[['invoice_title', 'Invoice Title'], ['invoice_recipient_prefix', 'Recipient Prefix'], ['invoice_item_label', 'Item Column'], ['invoice_old_label', 'Old Label'], ['invoice_new_label', 'New Label'], ['invoice_usage_label', 'Usage Label'], ['invoice_price_label', 'Price Label'], ['invoice_total_label', 'Total Label'], ['invoice_issue_date_label', 'Issue Date Label'], ['invoice_period_label', 'Period Label'], ['invoice_area_label', 'Area Label'], ['invoice_address_label', 'Address Label'], ['invoice_phone_label', 'Phone Label'], ['invoice_meter_label', 'Meter Label']].map(([name, label]) => <div className="col-md-3 col-sm-4 col-6" key={name}>
                <label className="form-label">{label}</label>
                <input className="form-control" name={name} value={form[name] || ''} onChange={handleChange} />
              </div>)}
            <div className="col-md-9">
              <label className="form-label">Footer Note</label>
              <input className="form-control" name="notes" value={form.notes || ''} onChange={handleChange} placeholder="Optional bottom line" />
            </div>
          </div>
        </SectionCard>

      </form>
    </div>;
}
