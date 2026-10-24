import { Link, NavLink, Outlet } from 'react-router';

const TABS = [
  { to: '/', label: 'Today', end: true },
  { to: '/add', label: 'Add' },
  { to: '/renewals', label: 'Renewals' },
  { to: '/all', label: 'Everything' },
  { to: '/me', label: 'Me' },
] as const;

/** Bottom tabs, and Help on every screen. */
export function Layout() {
  return (
    <div className="min-h-dvh">
      <Link to="/help" className="btn fixed right-4 z-20 shadow" style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}>
        Help
      </Link>
      <Outlet />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--line)] bg-[var(--panel)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-2xl">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={'end' in t} className="tab">
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
