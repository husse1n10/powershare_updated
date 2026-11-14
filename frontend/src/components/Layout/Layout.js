import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LangContext';
import {
  FiHome, FiZap, FiUsers, FiFileText, FiSettings,
  FiBarChart2, FiList, FiLogOut, FiMenu, FiX, FiHash, FiBookOpen,
  FiCamera, FiBell, FiMessageSquare, FiActivity, FiClock, FiCreditCard, FiLink, FiLock,
} from 'react-icons/fi';

export default function Layout({ children }) {
  const { user, accessToken, logout } = useAuth();
  const { t, lang, switchLang } = useLang();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth <= 768);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handler = () => {
      const nextIsMobile = window.innerWidth <= 768;
      setIsMobileViewport(nextIsMobile);
      if (!nextIsMobile) setMobileOpen(false);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    if (!user?.id) { setUnreadNotifications(0); return undefined; }
    let active = true;
    const refreshUnread = async () => {
      try {
        const { data } = await api.get('/notifications', { params: { limit: 1 } });
        if (active) setUnreadNotifications(Number(data.unread || 0));
      } catch (_) {}
    };
    refreshUnread();
    window.addEventListener('powershare:notifications-changed', refreshUnread);

    let socket = null;
    if (accessToken && window.io) {
      socket = window.io({ auth: { token: accessToken }, withCredentials: true });
      socket.on('notification:new', notification => {
        setUnreadNotifications(count => count + 1);
        window.dispatchEvent(new CustomEvent('powershare:notification-new', { detail: notification }));
      });
    }
    return () => {
      active = false;
      window.removeEventListener('powershare:notifications-changed', refreshUnread);
      if (socket) socket.disconnect();
    };
  }, [user?.id, accessToken]);

  const isSidebarCollapsed = !isMobileViewport && collapsed;

  const adminNav = [
    { to: '/admin',            label: t.dashboard,   icon: <FiHome /> },
    { to: '/admin/applications', label: t.registrationApplications, icon: <FiList /> },
    { to: '/admin/users',      label: t.users,       icon: <FiUsers /> },
    { to: '/admin/generators', label: t.generators,  icon: <FiZap /> },
    { to: '/admin/reports',    label: t.reports || 'Reports',      icon: <FiBarChart2 /> },
    { to: '/admin/audit',      label: t.auditLog || 'Audit Log',    icon: <FiActivity /> },
    { to: '/notifications',    label: t.notifications || 'Notifications',icon: <FiBell /> },
    { to: '/support',          label: t.support || 'Support',      icon: <FiMessageSquare /> },
    { to: '/security',         label: t.security || 'Security',     icon: <FiLock /> },
    { to: '/admin/settings',   label: t.settings,    icon: <FiSettings /> },
  ];
  const ownerNav = [
    { to: '/owner',                label: t.dashboard,      icon: <FiHome /> },
    { to: '/owner/bills',          label: t.bills,          icon: <FiFileText /> },
    { to: '/owner/account-statement', label: t.accountStatement || 'Account Statement', icon: <FiBookOpen /> },
    { to: '/owner/collector',      label: t.collector,      icon: <FiBarChart2 /> },
    { to: '/owner/collector-assignments', label: t.collectorAssignments || 'Collector Assignments', icon: <FiLink /> },
    { to: '/owner/applications', label: t.registrationApplications, icon: <FiList /> },
    { to: '/owner/subscribers',    label: t.subscribers,    icon: <FiUsers /> },
    { to: '/owner/generators',     label: t.generators,     icon: <FiZap /> },
    { to: '/owner/main-meters',    label: t.mainMeters,     icon: <FiHash /> },
    { to: '/owner/plans',          label: t.plans,          icon: <FiList /> },
    { to: '/owner/meter-scan',     label: t.meterScan || 'Meter Scan', icon: <FiCamera /> },
    { to: '/owner/outages',        label: t.outages || 'Outages',        icon: <FiClock /> },
    { to: '/owner/reports',        label: t.reports || 'Reports',        icon: <FiBarChart2 /> },
    { to: '/notifications',        label: t.notifications || 'Notifications',  icon: <FiBell /> },
    { to: '/support',              label: t.support || 'Support',        icon: <FiMessageSquare /> },
    { to: '/security',             label: t.security || 'Security',       icon: <FiLock /> },
    { to: '/owner/settings',       label: t.settings,       icon: <FiSettings /> },
  ];
  const collectorNav = [
    { to: '/collector', label: t.dashboard || 'Dashboard', icon: <FiHome /> },
    { to: '/collector/bills', label: t.billsWallet, icon: <FiFileText /> },
    { to: '/collector/meter-scan', label: t.meterScan || 'Meter Scan', icon: <FiCamera /> },
    { to: '/notifications', label: t.notifications || 'Notifications', icon: <FiBell /> },
    { to: '/support', label: t.support || 'Support', icon: <FiMessageSquare /> },
    { to: '/security', label: t.security || 'Security', icon: <FiLock /> },
    { to: '/collector/settings', label: t.settings, icon: <FiSettings /> },
  ];
  const subscriberNav = [
    { to: '/subscriber', label: t.dashboard || 'Dashboard', icon: <FiHome /> },
    { to: '/subscriber/bills', label: t.billsInvoices || 'Bills & Invoices', icon: <FiFileText /> },
    { to: '/subscriber/consumption', label: t.consumption || 'Consumption', icon: <FiBarChart2 /> },
    { to: '/subscriber/payments', label: t.payments || 'Payments', icon: <FiCreditCard /> },
    { to: '/subscriber/outages', label: t.outages || 'Outages', icon: <FiClock /> },
    { to: '/notifications', label: t.notifications || 'Notifications', icon: <FiBell /> },
    { to: '/support', label: t.support || 'Support', icon: <FiMessageSquare /> },
    { to: '/security', label: t.security || 'Security', icon: <FiLock /> },
    { to: '/subscriber/settings', label: t.settings, icon: <FiSettings /> },
  ];

  const nav = user?.role === 'admin' ? adminNav
            : user?.role === 'owner' ? ownerNav
            : user?.role === 'collector' ? collectorNav
            : subscriberNav;
  const platformName = String(user?.platform_name || '').trim() || t.appName;

  const rootPaths = ['/admin', '/owner', '/collector', '/subscriber'];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarClass = [
    'sidebar',
    isSidebarCollapsed ? 'collapsed' : '',
    mobileOpen ? 'mobile-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <div>
      <a className="skip-link" href="#main-content">{t.skipToContent || 'Skip to main content'}</a>
      <div
        className={`sidebar-overlay${mobileOpen ? ' visible' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <div className={sidebarClass} role="navigation" aria-label="Main navigation">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon"><FiZap /></div>
          {!isSidebarCollapsed && <span className="sidebar-logo-text">{platformName}</span>}
        </div>

        <nav className="sidebar-nav">
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={rootPaths.includes(item.to)}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              {!isSidebarCollapsed && <span className="d-flex align-items-center gap-2">{item.label}{item.to === '/notifications' && unreadNotifications > 0 && <span className="badge rounded-pill text-bg-danger">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} aria-label={t.logout} title={t.logout}>
            <span className="nav-icon" aria-hidden="true"><FiLogOut /></span>
            {!isSidebarCollapsed && <span>{t.logout}</span>}
          </button>
        </div>
      </div>

      <div className={`main-wrapper${isSidebarCollapsed ? ' collapsed' : ''}`}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn"
              onClick={() => {
                if (isMobileViewport) setMobileOpen(o => !o);
                else setCollapsed(c => !c);
              }}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <FiX /> : <FiMenu />}
            </button>
          </div>

          <div className="topbar-right">
            <div className="lang-toggle" role="group" aria-label="Language">
              <button
                className={`lang-btn${lang === 'en' ? ' active' : ''}`}
                onClick={() => switchLang('en')}
              >EN</button>
              <button
                className={`lang-btn${lang === 'ar' ? ' active' : ''}`}
                onClick={() => switchLang('ar')}
              >AR</button>
            </div>
            <div className="topbar-user">
              <span className="topbar-user-name">{user?.full_name}</span>
              <span className="role-badge">{user?.role}</span>
              <div className="topbar-user-avatar" aria-hidden="true">
                {(user?.full_name || user?.username || '?')[0].toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="page-content" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
