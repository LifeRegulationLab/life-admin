import { useSyncExternalStore } from 'react';
import { moss } from '../lib/moss/link';
import type { MossMood } from '../lib/moss/pose';
import { GlowCanvas } from './GlowCanvas';

export function useMoss() {
  const settings = useSyncExternalStore(moss.subscribe, moss.getSettings);
  const link = useSyncExternalStore(moss.subscribe, moss.getLink);
  return { settings, link };
}

const MOOD_WORDS: Record<MossMood, string> = { ready: 'ready', listening: 'listening', thinking: 'working on it', speaking: 'reading aloud' };

/**
 * Moss's face. It shows what the app is doing, never a feeling. Movement is off when the
 * phone asks for less motion or the person switches it off.
 */
export function Moss({ mood = 'ready', size = 48, decorative = false }: { mood?: MossMood; size?: number; decorative?: boolean }) {
  const { settings } = useMoss();
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': `${settings.name}, ${MOOD_WORDS[mood]}` };
  return (
    <span
      className={`moss-face moss-${mood}${settings.motion ? ' moss-moves' : ''}`}
      style={{ display: 'inline-block', flex: 'none', width: size, height: size }}
      {...a11y}
    >
      <GlowCanvas mood={mood} size={size} motion={settings.motion} />
    </span>
  );
}
