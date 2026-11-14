import React from 'react';
import { useLang } from '../../contexts/LangContext';

export default function PendingApplication({ application, onRefresh }) {
  const { t } = useLang();
  return <div>
    <div className="page-header"><h4 className="page-title">{t.subscriberDashboard}</h4></div>
    <div role="status" className="alert alert-info d-block"><h5>{t.pendingMeterAssignment}</h5><p className="mb-0">{t.pendingApplicationInfo}</p></div>
    <div className="table-card p-3">
      <h5>{t.applicationDetails}</h5>
      <p><strong>{t.requestedGenerator}:</strong> {application.generator_name}</p>
      <p><strong>{t.serviceArea}:</strong> {application.location_name}</p>
      <p><strong>{t.applicationProvider}:</strong> {application.provider_name || '—'}</p>
      <p><strong>{t.installationAddress}:</strong> {application.location_address}</p>
      <button type="button" className="btn btn-primary" onClick={onRefresh}>{t.refreshStatus}</button>
    </div>
  </div>;
}
