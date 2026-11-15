import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LangContext';
import { FiZap, FiUser, FiLock, FiLogIn } from 'react-icons/fi';

export default function Login() {
  const { login } = useAuth();
  const { t, lang, switchLang } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const user = await login(form.username.trim(), form.password);
      const dest = from || (
        user.role === 'admin' ? '/admin'
        : user.role === 'owner' ? '/owner'
        : user.role === 'collector' ? '/collector'
        : '/subscriber'
      );
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || t.loginFailed);
    } finally { setLoading(false); }
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        {/* Lang toggle */}
        <div style={{ position:'absolute', top:16, right:16 }}>
          <div className="lang-toggle">
            <button className={`lang-btn${lang==='en'?' active':''}`} onClick={() => switchLang('en')}>EN</button>
            <button className={`lang-btn${lang==='ar'?' active':''}`} onClick={() => switchLang('ar')}>AR</button>
          </div>
        </div>

        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div className="login-logo"><FiZap /></div>
          <h2 style={{ margin:'0 0 4px', color:'var(--text)', fontSize:'1.25rem', fontWeight:700 }}>
            {t.appName}
          </h2>
          <p style={{ color:'var(--text-muted)', margin:0, fontSize:'0.82rem' }}>Lebanon</p>
        </div>

        {error && (
          <div className="alert alert-danger mb-3" style={{ fontSize:'0.84rem' }}>
            <FiLock style={{ flexShrink:0 }} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="login-username" className="form-label">{t.username}</label>
            <div className="search-wrap">
              <span className="search-icon"><FiUser /></span>
              <input
                id="login-username"
                className="form-control"
                value={form.username}
                onChange={e => setForm(f=>({...f,username:e.target.value}))}
                required autoFocus
                autoComplete="username"
              />
            </div>
          </div>
          <div className="mb-4">
            <label htmlFor="login-password" className="form-label">{t.password}</label>
            <div className="search-wrap">
              <span className="search-icon"><FiLock /></span>
              <input
                id="login-password"
                type="password"
                className="form-control"
                value={form.password}
                onChange={e => setForm(f=>({...f,password:e.target.value}))}
                required
                autoComplete="current-password"
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={loading}
            style={{ padding:'9px', justifyContent:'center', fontSize:'0.9rem', fontWeight:600 }}
          >
            {loading
              ? <><span className="spinner-border spinner-border-sm" style={{ marginRight:8 }} />{t.signingIn}</>
              : <><FiLogIn style={{ marginRight:6 }} />{t.signIn}</>
            }
          </button>
        </form>
        <div style={{textAlign:'center',marginTop:16,fontSize:'0.84rem',color:'var(--text-muted)'}}>Subscriber without an account? <Link to="/register">Register here</Link></div>
      </div>
    </div>
  );
}
