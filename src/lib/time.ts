import { useState } from 'react';

/** The time when the screen opened. Screens use it for "today" so a list does not shift while open. */
export function useNow(): number {
  const [t] = useState(() => Date.now());
  return t;
}

/** The time now, for event handlers. */
export function clock(): number {
  return Date.now();
}
