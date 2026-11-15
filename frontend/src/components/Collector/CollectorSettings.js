import { PASSWORD_PATTERN } from '../../utils/passwordPolicy';
import React, { useCallback, useEffect, useState } from 'react';
import { FiSave, FiSettings, FiUser } from 'react-icons/fi';
import api from '../../services/api';
import { useLang } from '../../contexts/LangContext';
import { useAuth } from '../../contexts/AuthContext';
export default function CollectorSettings() {
  const {
    t
  } = useLang();
  const {
    reloadUser
  } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    phone: '',
    password: ''
  });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/me');
      const me = res.data || {};
      setForm({
        full_name: me.full_name || '',
        username: me.username || '',
        phone: me.phone || '',
        password: ''
      });
    } catch (err) {
      setMsg({
        type: 'danger',
        text: err.response?.data?.error || 'Failed to load settings'
      });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const handleSubmit = async e => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setMsg(null);
    try {
      await api.put('/auth/profile', form);
      setForm(f => ({
        ...f,
        password: ''
      }));
      await reloadUser();
      setMsg({
        type: 'success',
        text: 'Personal info updated.'
      });
    } catch (err) {
      setMsg({
        type: 'danger',
        text: err.response?.data?.error || 'Failed to save settings'
      });
    } finally {
      setSaving(false);
    }
  };
  const handleChange = e => {
    const {
      name,
      value
    } = e.target;
    setForm(f => ({
      ...f,
      [name]: value
    }));
  };
  if (loading) {
    return <div style={{
      display: 'flex',
      justifyContent: 'center',
      padding: '40px 0'
    }}>
        <div className="spinner-border" />
      </div>;
  }
  return <div>
      <div className="page-header">
        <h4 className="page-title"><FiSettings style={{
          marginRight: 7,
          verticalAlign: 'middle'
        }} />{t.settings}</h4>
      </div>

      {msg && <div className={`alert alert-${msg.type} alert-dismissible mb-3`}>
          {msg.text}
          <button className="btn-close" onClick={() => setMsg(null)}>x</button>
        </div>}

      <div className="table-card">
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
          <button type="submit" form="collectorPersonalSettings" className="btn btn-sm btn-outline-primary" disabled={saving} style={{
          minWidth: 120,
          justifyContent: 'center'
        }}>
            {saving ? <><span className="spinner-border spinner-border-sm" style={{
              marginRight: 8
            }} />Saving...</> : <><FiSave style={{
              marginRight: 6
            }} />{t.saveChanges || t.save}</>}
          </button>
        </div>

        <div style={{
        padding: '16px'
      }}>
          <form id="collectorPersonalSettings" onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">{t.fullName} *</label>
                <input className="form-control" name="full_name" value={form.full_name} onChange={handleChange} required autoFocus />
              </div>
              <div className="col-md-4">
                <label className="form-label">{t.username || 'Username'} *</label>
                <input className="form-control" name="username" value={form.username} onChange={handleChange} required minLength={3} pattern="[A-Za-z0-9_.-]+" />
              </div>
              <div className="col-md-4">
                <label className="form-label">{t.phone}</label>
                <input className="form-control" name="phone" value={form.phone} onChange={handleChange} placeholder="+961XXXXXXXX" pattern="[+]961[0-9]{6,10}" title="Must start with +961" />
              </div>
              <div className="col-md-4">
                <label className="form-label">{t.password || 'Password'}</label>
                <input type="password" className="form-control" name="password" value={form.password} onChange={handleChange} minLength={8} pattern={PASSWORD_PATTERN} title="At least 8 characters: uppercase, lowercase, number and symbol" placeholder="Use Password & Security page" disabled maxLength={72} />
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>;
}
