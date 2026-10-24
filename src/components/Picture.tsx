import type { PictureName } from '../lib/content/kinds';

/**
 * Simple pictures for easy-read: one plain drawing beside each kind of thing and each step.
 * Drawn as lines in the text colour, so they work in light and dark.
 */

const PATHS: Record<PictureName, string[]> = {
  letter: ['M3 6h18v12H3z', 'M3 7l9 6 9-6'],
  email: ['M4 6h16v12H4z', 'M4 7l8 6 8-6', 'M17 3l3 3-3 3'],
  form: ['M6 3h9l3 3v15H6z', 'M9 9h6', 'M9 13h6', 'M9 17h4'],
  bill: ['M6 3h12v18l-3-2-3 2-3-2-3 2z', 'M14 8a2.5 2.5 0 0 0-4 1c0 3-1 4-1 5h5', 'M9 11.5h4'],
  renew: ['M20 12a8 8 0 1 1-2.3-5.6', 'M20 4v4h-4'],
  calendar: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v5', 'M16 3v5', 'M8 14h3v3H8z'],
  phone: ['M7 3h4l1.5 4.5-2.5 1.5a11 11 0 0 0 5 5l1.5-2.5L21 13v4a2 2 0 0 1-2 2A16 16 0 0 1 5 5a2 2 0 0 1 2-2z'],
  other: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M8 12h.01', 'M12 12h.01', 'M16 12h.01'],
  find: ['M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z', 'M15.5 15.5L20 20'],
  write: ['M4 20h4L19 9l-4-4L4 16z', 'M13 7l4 4'],
  send: ['M3 11l18-8-8 18-2-8z', 'M11 13l10-10'],
  proof: ['M6 3h12v18H6z', 'M9 12l2 2 4-4'],
  pay: ['M3 7h18v10H3z', 'M3 10h18', 'M7 14h4'],
  wait: ['M7 3h10', 'M7 21h10', 'M8 3c0 5 8 5 8 9s-8 4-8 9', 'M16 3c0 5-8 5-8 9s8 4 8 9'],
  check: ['M5 12l4 4 10-10'],
  go: ['M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z', 'M12 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'],
  camera: ['M4 8h4l2-3h4l2 3h4v11H4z', 'M12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z'],
  paste: ['M8 4h8v3H8z', 'M6 5H5v16h14V5h-1', 'M9 12h6', 'M9 16h6'],
  type: ['M3 7h18v10H3z', 'M6 10h.01', 'M10 10h.01', 'M14 10h.01', 'M18 10h.01', 'M7 14h10'],
  pile: ['M4 15h16v4H4z', 'M5 11h14v4', 'M6 7h12v4'],
  pause: ['M8 5v14', 'M16 5v14'],
  done: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M8 12l3 3 5-6'],
  person: ['M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M4 21a8 8 0 0 1 16 0'],
  speaker: ['M4 9h4l5-4v14l-5-4H4z', 'M16 9a4 4 0 0 1 0 6', 'M19 6a8 8 0 0 1 0 12'],
};

export function Picture({ name, size = 28, className = '' }: { name: PictureName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
