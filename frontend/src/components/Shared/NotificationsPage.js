import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { FiBell, FiCheckCircle } from 'react-icons/fi';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setItems(data.items || []);
      setUnread(Number(data.unread || 0));
      setError('');
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load notifications.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const onNew = () => load();
    window.addEventListener('powershare:notification-new', onNew);
    return () => window.removeEventListener('powershare:notification-new', onNew);
  }, [load]);

  const markRead = async (n) => {
    if (!n.is_read) { await api.put(`/notifications/${n.id}/read`); window.dispatchEvent(new Event('powershare:notifications-changed')); }
    if (n.action_url) navigate(n.action_url);
    else load();
  };

  const markAll = async () => {
    await api.put('/notifications/read-all');
    window.dispatchEvent(new Event('powershare:notifications-changed'));
    load();
  };

  return <div>
    <div className="page-header">
      <div><h4 className="page-title"><FiBell /> Notifications</h4><div className="text-muted">{unread} unread notification{unread === 1 ? '' : 's'}</div></div>
      <button className="btn btn-outline-primary" onClick={markAll} disabled={!unread}><FiCheckCircle /> Mark all read</button>
    </div>
    {error && <div className="alert alert-danger">{error}</div>}
    {loading ? <div className="spinner-border" /> : <div className="table-card">
      {items.map(n => <button key={n.id} type="button" className="w-100 text-start" onClick={() => markRead(n)} style={{border:0,borderBottom:'1px solid var(--border)',background:n.is_read?'transparent':'var(--bg3)',padding:'14px 16px',color:'var(--text)'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12}}><b>{n.title}</b><small className="text-muted">{new Date(n.created_at).toLocaleString()}</small></div>
        <div className="text-muted" style={{marginTop:4}}>{n.message}</div>
        <small style={{textTransform:'capitalize'}}>{n.type}</small>
      </button>)}
      {!items.length && <div className="p-4 text-center text-muted">No notifications yet.</div>}
    </div>}
  </div>;
}
