import UiText from "../Shared/UiText";
import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { FiShield } from 'react-icons/fi';
import { auditActorLabel } from '../../utils/auditActor';
export default function AdminAudit() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    api.get('/admin/audit-logs', {
      params: {
        limit: 300
      }
    }).then(r => setRows(r.data || [])).catch(e => setErr(e.response?.data?.error || 'Failed'));
  }, []);
  return <div><div className="page-header"><h4 className="page-title"><FiShield /><UiText> Activity & Audit Log</UiText></h4></div>{err && <div className="alert alert-danger">{err}</div>}<div className="table-card"><div className="table-responsive"><table className="table table-hover mb-0"><thead><tr><th><UiText>Date</UiText></th><th><UiText>User</UiText></th><th><UiText>Action</UiText></th><th><UiText>Entity</UiText></th><th><UiText>Route</UiText></th><th><UiText>IP</UiText></th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{new Date(r.created_at).toLocaleString()}</td><td>{auditActorLabel(r)}</td><td><code>{r.action}</code></td><td>{r.entity_type || '—'} {r.entity_id ? `#${r.entity_id}` : ''}</td><td>{r.method} {r.route}</td><td>{r.ip_address || '—'}</td></tr>)}{!rows.length && <tr><td colSpan="6" className="text-center text-muted p-4"><UiText>No audit records.</UiText></td></tr>}</tbody></table></div></div></div>;
}
