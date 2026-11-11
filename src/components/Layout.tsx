import { useEffect } from 'react';
import { accountsOn } from '../lib/account';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { APP_NAME } from '../lib/brand';
import { useStore } from '../lib/store/StoreProvider';
import { TabIcon } from './TabIcon';
import { MossButton } from './MossCompanion';
import { MOSS_ACTIONS, MOSS_SETTINGS } from '../lib/moss/actions';
import { UndoBar } from './UndoBar';

const TABS = [
  { to: '/', icon: 'today', label: 'Today', end: true },
  { to: '/add', icon: 'add', label: 'Add' },
  { to: '/money', icon: 'money', label: 'Money' },
  { to: '/all', icon: 'everything', label: 'Records' },
  { to: '/me', icon: 'me', label: 'Me' },
] as const;

export function Layout() {
  const { user, syncIssue } = useStore();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="moss-lift-tabs min-h-dvh">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="app-header"><div className="app-header-inner"><Link to="/" className="brand-lockup"><img src="/icons/favicon-32.png" alt="" width="28" height="28" /><span>{APP_NAME}<span className="brand-caption">Life Regulation Lab</span></span></Link><Link to="/help" className="btn help-link">Help</Link></div></header>
      {!user && accountsOn() && import.meta.env['VITE_SHOWCASE'] !== 'true' && <div className="account-note">Looking around. <Link to="/signin" className="underline">Make an account</Link> to keep your records across devices.</div>}
      {syncIssue && <div className="sync-notice warnbox" role="alert">{syncIssue}</div>}
      <Outlet />
      {pathname !== '/' && <MossButton actions={MOSS_ACTIONS} settingsTo={MOSS_SETTINGS} />}
      <UndoBar />
      <nav aria-label="Main" className="bottom-nav"><div className="nav-inner">{TABS.map(t => <NavLink key={t.to} to={t.to} end={'end' in t} className={({ isActive }) => `tab${isActive || (t.to === '/all' && ['/renewals', '/looking-back'].some(p => pathname.startsWith(p))) ? ' selected' : ''}`}><span className="tab-icon"><TabIcon name={t.icon} /></span>{t.label}</NavLink>)}</div></nav>
    </div>
  );
}
