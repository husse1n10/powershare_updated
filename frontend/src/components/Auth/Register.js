import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useLang } from '../../contexts/LangContext';
import { PASSWORD_PATTERN } from '../../utils/passwordPolicy';

export default function Register() {
  const nav = useNavigate();
  const { t } = useLang();
  const timer = useRef(null);
  const [form, setForm] = useState({ full_name: '', username: '', email: '', phone: '+961', password: '', preferred_language: 'en' });
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const update = e => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async e => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      await api.post('/auth/register', form);
      setSubmitted(true); setMsg({ type: 'success', text: t.registrationSubmitted });
      timer.current = setTimeout(() => nav('/login'), 1500);
    } catch (err) { setMsg({ type: 'danger', text: err.response?.data?.error || t.failed }); }
    finally { setBusy(false); }
  };
  return <div className="login-bg"><div className="login-card" style={{ maxWidth: 620 }}>
    <div className="text-center mb-3"><h2>PowerShare</h2><p>{t.registerTitle}</p></div>
    <div className="alert alert-info">{t.registerInstructions}</div>
    {msg && <div role={msg.type === 'danger' ? 'alert' : 'status'} className={`alert alert-${msg.type}`}>{msg.text}</div>}
    <form onSubmit={submit}>
      <div className="row g-3">
        <div className="col-sm-6"><label htmlFor="register-name" className="form-label">{t.fullName}</label><input id="register-name" name="full_name" className="form-control" required minLength={2} maxLength={150} autoComplete="name" value={form.full_name} onChange={update} /></div>
        <div className="col-sm-6"><label htmlFor="register-username" className="form-label">{t.username}</label><input id="register-username" name="username" className="form-control" required minLength={3} maxLength={80} pattern="[A-Za-z0-9_.\-]+" autoComplete="username" value={form.username} onChange={update} /></div>
        <div className="col-sm-6"><label htmlFor="register-phone" className="form-label">{t.phone}</label><input id="register-phone" name="phone" type="tel" className="form-control" required pattern="[+]961[0-9]{6,10}" autoComplete="tel" value={form.phone} onChange={update} /></div>
        <div className="col-sm-6"><label htmlFor="register-email" className="form-label">{t.email} ({t.optional || 'optional'})</label><input id="register-email" name="email" type="email" maxLength={150} className="form-control" autoComplete="email" value={form.email} onChange={update} /></div>
        <div className="col-sm-6"><label htmlFor="register-password" className="form-label">{t.password}</label><input id="register-password" name="password" type="password" className="form-control" required minLength={8} maxLength={72} pattern={PASSWORD_PATTERN} title={t.strongPasswordHelp} aria-describedby="register-password-help" autoComplete="new-password" value={form.password} onChange={update} /><small id="register-password-help" className="text-muted">{t.strongPasswordHelp}</small></div>
        <div className="col-sm-6"><label htmlFor="register-language" className="form-label">{t.language}</label><select id="register-language" name="preferred_language" className="form-select" value={form.preferred_language} onChange={update}><option value="en">English</option><option value="ar">العربية</option></select></div>
      </div>
      <button type="submit" className="btn btn-primary w-100 mt-4" disabled={busy || submitted}>{busy ? t.saving : t.createAccount}</button>
    </form>
    <div className="mt-3 text-center"><Link to="/login">{t.backToLogin || 'Back to login'}</Link></div>
  </div></div>;
}
