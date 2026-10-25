import { Link, NavLink, Outlet } from 'react-router';
import { firebaseConfigured } from '../lib/firebase/app';
import { useStore } from '../lib/store/StoreProvider';
import { TabIcon } from './TabIcon';
import { UndoBar } from './UndoBar';

const TABS = [
  { to: '/', icon: 'today', label: 'Today', end: true },
  { to: '/add', icon: 'add', label: 'Add' },
  { to: '/renewals', icon: 'renewals', label: 'Renewals' },
  { to: '/all', icon: 'everything', label: 'Everything' },
  { to: '/me', icon: 'me', label: 'Me' },
] as const;

/** Bottom tabs, Help on every screen, and a line asking for an account while someone looks around. */
export function Layout() {
  const { user } = useStore();
  return (
    <div className="min-h-dvh">
      {!user && firebaseConfigured() && import.meta.env['VITE_SHOWCASE'] !== 'true' ? (
        <div className="bg-[var(--panel)] px-4 py-2 pr-24 text-sm" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
          You are looking around.{' '}
          <Link to="/signin" className="underline">
            Make an account
          </Link>{' '}
          to keep what you add safe.
        </div>
      ) : null}
      <Link to="/help" className="btn fixed right-4 z-20 shadow" style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}>
        Help
      </Link>
      <Outlet />
      <UndoBar />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--line)] bg-[var(--panel)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-2xl">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={'end' in t} className="tab">
              <TabIcon name={t.icon} />
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
