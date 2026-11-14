import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LangProvider } from './contexts/LangContext';
import { ConfirmDialogProvider } from './contexts/ConfirmDialogContext';
import { RequireAuth, RedirectIfAuth } from './components/Shared/RouteGuards';
import ErrorBoundary from './components/Shared/ErrorBoundary';
import { useLang } from './contexts/LangContext';
import { useGlobalFormEnterNavigation, usePreventNumberInputWheelChange } from './utils/formNavigation';
import Layout from './components/Layout/Layout';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';

function UnauthorizedPage() {
  const { t } = useLang();
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', textAlign:'center', padding:'20px' }}>
      <div>
        <h2 style={{ color:'var(--text)' }}>{t.accessDenied || 'Access Denied'}</h2>
        <p style={{ color:'var(--text-muted)' }}>{t.noPermission || 'You do not have permission to view this page.'}</p>
        <a href="/login" className="btn btn-primary">{t.backToLogin || 'Back to Login'}</a>
      </div>
    </div>
  );
}

const AdminDashboard  = lazy(() => import('./components/Admin/AdminPages').then((m) => ({ default: m.AdminDashboard })));
const AdminUsers      = lazy(() => import('./components/Admin/AdminPages').then((m) => ({ default: m.AdminUsers })));
const AdminGenerators = lazy(() => import('./components/Admin/AdminPages').then((m) => ({ default: m.AdminGenerators })));
const AdminSettings   = lazy(() => import('./components/Admin/AdminPages').then((m) => ({ default: m.AdminSettings })));
const AdminApplications = lazy(() => import('./components/Admin/AdminApplications'));
const AdminAudit      = lazy(() => import('./components/Admin/AdminAudit'));
const ReportsPage     = lazy(() => import('./components/Shared/ReportsPage'));
const NotificationsPage = lazy(() => import('./components/Shared/NotificationsPage'));
const SupportPage     = lazy(() => import('./components/Shared/SupportPage'));
const SecurityPage    = lazy(() => import('./components/Shared/SecurityPage'));

const OwnerDashboard   = lazy(() => import('./components/Owner/OwnerDashboard'));
const OwnerGenerators  = lazy(() => import('./components/Owner/OwnerGenerators'));
const OwnerMainMeters  = lazy(() => import('./components/Owner/OwnerMainMeters'));
const OwnerPlans       = lazy(() => import('./components/Owner/OwnerPlansOutages').then((m) => ({ default: m.OwnerPlans })));
const OwnerSubscribers = lazy(() => import('./components/Owner/OwnerSubscribers'));
const OwnerBills       = lazy(() => import('./components/Owner/OwnerBills'));
const OwnerAccountStatement = lazy(() => import('./components/Owner/OwnerAccountStatement'));
const OwnerSettings    = lazy(() => import('./components/Owner/OwnerSettings'));
const OwnerCollector   = lazy(() => import('./components/Owner/OwnerCollector'));
const OwnerCollectorAssignments = lazy(() => import('./components/Owner/OwnerCollectorAssignments'));
const OwnerMeterScan   = lazy(() => import('./components/Owner/OwnerMeterScan'));
const OwnerOutages     = lazy(() => import('./components/Owner/OwnerOutages'));

const SubscriberDashboard = lazy(() => import('./components/Subscriber/SubscriberDashboard'));
const SubscriberBills = lazy(() => import('./components/Subscriber/SubscriberBills'));
const SubscriberConsumption = lazy(() => import('./components/Subscriber/SubscriberConsumption'));
const SubscriberPayments = lazy(() => import('./components/Subscriber/SubscriberPayments'));
const SubscriberOutages = lazy(() => import('./components/Subscriber/SubscriberOutages'));
const SubscriberSettings = lazy(() => import('./components/Subscriber/SubscriberSettings'));

const CollectorDashboard = lazy(() => import('./components/Collector/CollectorDashboard'));
const CollectorBills = lazy(() => import('./components/Collector/CollectorBills'));
const CollectorSettings = lazy(() => import('./components/Collector/CollectorSettings'));
const CollectorMeterScan = lazy(() => import('./components/Collector/CollectorMeterScan'));

function PageLoader() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div className="spinner-border" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
}

function ProtectedPage({ roles, children }) {
  return (
    <RequireAuth roles={roles}>
      <Layout>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            {children}
          </Suspense>
        </ErrorBoundary>
      </Layout>
    </RequireAuth>
  );
}

export default function App() {
  useGlobalFormEnterNavigation();
  usePreventNumberInputWheelChange();

  return (
    <LangProvider>
      <ConfirmDialogProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<RedirectIfAuth><Login /></RedirectIfAuth>} />
              <Route path="/register" element={<RedirectIfAuth><Register /></RedirectIfAuth>} />
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route
                path="/unauthorized"
                element={<UnauthorizedPage />}
              />
              <Route path="/admin"             element={<ProtectedPage roles={['admin']}><AdminDashboard /></ProtectedPage>} />
              <Route path="/admin/applications" element={<ProtectedPage roles={['admin']}><AdminApplications /></ProtectedPage>} />
              <Route path="/admin/users"       element={<ProtectedPage roles={['admin']}><AdminUsers /></ProtectedPage>} />
              <Route path="/admin/generators"  element={<ProtectedPage roles={['admin']}><AdminGenerators /></ProtectedPage>} />
              <Route path="/admin/settings"    element={<ProtectedPage roles={['admin']}><AdminSettings /></ProtectedPage>} />
              <Route path="/admin/reports"     element={<ProtectedPage roles={['admin']}><ReportsPage /></ProtectedPage>} />
              <Route path="/admin/audit"       element={<ProtectedPage roles={['admin']}><AdminAudit /></ProtectedPage>} />

              <Route path="/owner/applications" element={<ProtectedPage roles={['owner']}><AdminApplications apiBase="/owner/registration-applications" /></ProtectedPage>} />
              <Route path="/owner"                  element={<ProtectedPage roles={['owner']}><OwnerDashboard /></ProtectedPage>} />
              <Route path="/owner/generators"       element={<ProtectedPage roles={['owner']}><OwnerGenerators /></ProtectedPage>} />
              <Route path="/owner/main-meters"      element={<ProtectedPage roles={['owner']}><OwnerMainMeters /></ProtectedPage>} />
              <Route path="/owner/plans"            element={<ProtectedPage roles={['owner']}><OwnerPlans /></ProtectedPage>} />
              <Route path="/owner/subscribers"      element={<ProtectedPage roles={['owner']}><OwnerSubscribers /></ProtectedPage>} />
              <Route path="/owner/bills"            element={<ProtectedPage roles={['owner']}><OwnerBills /></ProtectedPage>} />
              <Route path="/owner/meter-scan"       element={<ProtectedPage roles={['owner']}><OwnerMeterScan /></ProtectedPage>} />
              <Route path="/owner/account-statement" element={<ProtectedPage roles={['owner']}><OwnerAccountStatement /></ProtectedPage>} />
              <Route path="/owner/collector"        element={<ProtectedPage roles={['owner']}><OwnerCollector /></ProtectedPage>} />
              <Route path="/owner/collector-assignments" element={<ProtectedPage roles={['owner']}><OwnerCollectorAssignments /></ProtectedPage>} />
              <Route path="/owner/meter-readings"   element={<Navigate to="/owner/meter-scan" replace />} />
              <Route path="/owner/settings"         element={<ProtectedPage roles={['owner']}><OwnerSettings /></ProtectedPage>} />
              <Route path="/owner/outages"          element={<ProtectedPage roles={['owner']}><OwnerOutages /></ProtectedPage>} />
              <Route path="/owner/reports"          element={<ProtectedPage roles={['owner']}><ReportsPage /></ProtectedPage>} />

              <Route path="/collector" element={<ProtectedPage roles={['collector']}><CollectorDashboard /></ProtectedPage>} />
              <Route path="/collector/bills" element={<ProtectedPage roles={['collector']}><CollectorBills /></ProtectedPage>} />
              <Route path="/collector/meter-scan" element={<ProtectedPage roles={['collector']}><CollectorMeterScan /></ProtectedPage>} />
              <Route path="/collector/settings" element={<ProtectedPage roles={['collector']}><CollectorSettings /></ProtectedPage>} />

              <Route path="/subscriber" element={<ProtectedPage roles={['subscriber']}><SubscriberDashboard /></ProtectedPage>} />
              <Route path="/subscriber/bills" element={<ProtectedPage roles={['subscriber']}><SubscriberBills /></ProtectedPage>} />
              <Route path="/subscriber/consumption" element={<ProtectedPage roles={['subscriber']}><SubscriberConsumption /></ProtectedPage>} />
              <Route path="/subscriber/payments" element={<ProtectedPage roles={['subscriber']}><SubscriberPayments /></ProtectedPage>} />
              <Route path="/subscriber/outages" element={<ProtectedPage roles={['subscriber']}><SubscriberOutages /></ProtectedPage>} />
              <Route path="/subscriber/settings" element={<ProtectedPage roles={['subscriber']}><SubscriberSettings /></ProtectedPage>} />

              <Route path="/notifications" element={<ProtectedPage roles={['admin','owner','collector','subscriber']}><NotificationsPage /></ProtectedPage>} />
              <Route path="/support" element={<ProtectedPage roles={['admin','owner','collector','subscriber']}><SupportPage /></ProtectedPage>} />
              <Route path="/security" element={<ProtectedPage roles={['admin','owner','collector','subscriber']}><SecurityPage /></ProtectedPage>} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ConfirmDialogProvider>
    </LangProvider>
  );
}
