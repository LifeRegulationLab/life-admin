import type { ReactNode } from 'react';

/** Line icons for the bottom tabs, drawn in the text colour like the icons in Pace and Mull. */
const PATHS: Record<string, ReactNode> = {
  help: <><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3M12 17h.01" /></>,
  money: <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M3 9h18M16 13h5v4h-5z" /></>,
  benefits: <><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z" /><path d="m8 12 3 3 5-6" /></>,
  report: <><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7" /></>,
  in: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
  out: <><path d="M12 15V3m-5 5 5-5 5 5M4 16v5h16v-5" /></>,
  today: (
    <>
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  add: (
    <>
      <circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" />
    </>
  ),
  renewals: (
    <>
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" /><path d="M20 20v-4h-4" />
    </>
  ),
  everything: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" />
    </>
  ),
  me: (
    <>
      <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
};

export function TabIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
