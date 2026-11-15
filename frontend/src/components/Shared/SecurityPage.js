import UiText from "../Shared/UiText";
import { PASSWORD_PATTERN } from '../../utils/passwordPolicy';
import React, { useState } from 'react';
import api from '../../services/api';
import { FiLock } from 'react-icons/fi';
export default function SecurityPage() {
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    setMsg(null);
    if (form.new_password !== form.confirm_password) {
      setMsg({
        type: 'danger',
        text: 'New passwords do not match.'
      });
      return;
    }
    setBusy(true);
    try {
      await api.put('/auth/change-password', {
        current_password: form.current_password,
        new_password: form.new_password
      });
      setMsg({
        type: 'success',
        text: 'Password changed successfully. Please sign in again.'
      });
      setTimeout(() => {
        window.location.href = '/login';
      }, 1200);
    } catch (err) {
      setMsg({
        type: 'danger',
        text: err.response?.data?.error || 'Password change failed.'
      });
    } finally {
      setBusy(false);
    }
  };
  return <div><div className="page-header"><h4 className="page-title"><FiLock /><UiText> Password & Security</UiText></h4></div>{msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}<form className="table-card p-3" style={{
      maxWidth: 620
    }} onSubmit={submit}><p className="text-muted"><UiText>For security, your current password is required before setting a new password.</UiText></p><div className="mb-3"><label className="form-label"><UiText>Current Password</UiText></label><input type="password" className="form-control" value={form.current_password} onChange={e => setForm({
          ...form,
          current_password: e.target.value
        })} required autoComplete="current-password" /></div><div className="mb-3"><label className="form-label"><UiText>New Password</UiText></label><input type="password" className="form-control" minLength="8" maxLength={72} pattern={PASSWORD_PATTERN} value={form.new_password} onChange={e => setForm({
          ...form,
          new_password: e.target.value
        })} required autoComplete="new-password" /></div><div className="mb-3"><label className="form-label"><UiText>Confirm New Password</UiText></label><input type="password" className="form-control" minLength="8" maxLength={72} pattern={PASSWORD_PATTERN} value={form.confirm_password} onChange={e => setForm({
          ...form,
          confirm_password: e.target.value
        })} required autoComplete="new-password" /></div><button className="btn btn-primary" disabled={busy}><UiText>{busy ? 'Changing...' : 'Change Password'}</UiText></button></form></div>;
}
