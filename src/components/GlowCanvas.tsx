import { useEffect, useRef } from 'react';
import { GLOW_BLEED, GLOW_BOX, drawGlow } from '../lib/moss/glow';
import type { GlowMood } from '../lib/moss/glow';

const clock = () => performance.now() / 1000;

/**
 * Moss drawn on a canvas that reaches a little past `size`, so the glow can fade out around it while
 * Moss still takes up `size` on the page. Moving when `motion` is on and the device has not asked for
 * less; otherwise it holds still.
 */
export function GlowCanvas({ mood, size, motion }: { mood: GlowMood; size: number; motion: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({ mood, previous: mood, changedAt: -100, pokedAt: -100, moving: false });

  useEffect(() => {
    const s = state.current;
    if (s.mood !== mood) {
      s.previous = s.mood;
      s.mood = mood;
      s.changedAt = clock();
    }
  }, [mood]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext?.('2d');
    if (!el || !ctx) return;
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    const side = (size * (GLOW_BOX + GLOW_BLEED * 2)) / GLOW_BOX;
    el.width = Math.round(side * ratio);
    el.height = Math.round(side * ratio);
    const s = state.current;
    const less = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let last = 0;
    const paint = () => drawGlow(ctx, el.width, { ...s, time: clock() });
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - last < 30) return;
      last = now;
      paint();
    };
    const start = () => {
      cancelAnimationFrame(frame);
      s.moving = motion && !less?.matches;
      if (s.moving) frame = requestAnimationFrame(tick);
      else paint();
    };
    start();
    less?.addEventListener?.('change', start);
    return () => {
      cancelAnimationFrame(frame);
      less?.removeEventListener?.('change', start);
    };
  }, [size, motion, mood]);

  return (
    <span
      style={{ position: 'relative', display: 'block', width: size, height: size }}
      onPointerDown={() => {
        if (state.current.moving) state.current.pokedAt = clock();
      }}
    >
      <canvas
        ref={canvas}
        aria-hidden="true"
        style={{
          position: 'absolute',
          pointerEvents: 'none',
          inset: `${(-size * GLOW_BLEED) / GLOW_BOX}px`,
          width: `${(size * (GLOW_BOX + GLOW_BLEED * 2)) / GLOW_BOX}px`,
          height: `${(size * (GLOW_BOX + GLOW_BLEED * 2)) / GLOW_BOX}px`,
        }}
      />
    </span>
  );
}
