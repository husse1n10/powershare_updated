import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api, { refreshAccessToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef(null);

  const reloadUser = useCallback(async () => {
    const res = await api.get('/auth/me');
    setUser(res.data);
    return res.data;
  }, []);

  const clearSession = useCallback(() => {
    delete api.defaults.headers.common.Authorization;
    setAccessToken(null);
    setUser(null);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  const logout = useCallback(async (silent = false) => {
    try { if(!silent) await api.post('/auth/logout', {}); } catch (_) {}
    clearSession();
  }, [clearSession]);

  const scheduleRefresh = useCallback((token) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    try {
      const encoded = String(token || '').split('.')[1] || '';
      const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
      const payload = JSON.parse(atob(base64));
      const expiresIn = (payload.exp * 1000) - Date.now() - 60000;
      if (expiresIn > 0) {
        refreshTimer.current = setTimeout(async () => {
          try {
            const nextAccessToken=await refreshAccessToken();
            setAccessToken(nextAccessToken);
            scheduleRefresh(nextAccessToken);
          } catch (_) { clearSession(); }
        }, expiresIn);
      }
    } catch (_) {}
  }, [clearSession]);

  // Restore a session using the HttpOnly refresh cookie. Nothing sensitive is
  // persisted in localStorage/sessionStorage.
  useEffect(() => {
    let active=true;
    (async()=>{
      try{
        const token=await refreshAccessToken();
        if(!active)return;
        setAccessToken(token);
        const res=await api.get('/auth/me');
        if(!active)return;
        setUser(res.data);
        scheduleRefresh(token);
      }catch(_){ if(active)clearSession(); }
      finally{ if(active)setLoading(false); }
    })();
    return () => { active=false; if (refreshTimer.current) clearTimeout(refreshTimer.current); };
  }, [clearSession, scheduleRefresh]);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    const { accessToken, user: userData } = res.data;
    api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
    setAccessToken(accessToken);
    setUser(userData);
    scheduleRefresh(accessToken);
    return userData;
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, logout, reloadUser, clearSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
