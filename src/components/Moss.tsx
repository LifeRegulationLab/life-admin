import { useId, useSyncExternalStore } from 'react';
import { moss } from '../lib/moss/link';
import { MOSS_BELLY, MOSS_BELLY_EDGE, MOSS_BODY, MOSS_COLOURS as C, POSES } from '../lib/moss/pose';
import type { Arm, MossMood } from '../lib/moss/pose';

export function useMoss() {
  const settings = useSyncExternalStore(moss.subscribe, moss.getSettings);
  const link = useSyncExternalStore(moss.subscribe, moss.getLink);
  return { settings, link };
}

const MOOD_WORDS: Record<MossMood, string> = { ready: 'ready', listening: 'listening', thinking: 'working on it', speaking: 'reading aloud' };

function ArmShape({ arm, outline }: { arm: Arm; outline: boolean }) {
  const pad = outline ? 4 : 0;
  return (
    <ellipse
      cx={arm.x}
      cy={arm.y}
      rx={arm.rx + pad}
      ry={arm.ry + pad}
      fill={outline ? C.outline : C.ink}
      transform={`rotate(${arm.turn} ${arm.x} ${arm.y})`}
    />
  );
}

/**
 * Moss's face. It shows what the app is doing, never a feeling. Movement is off when the
 * phone asks for less motion or the person switches it off.
 */
export function Moss({ mood = 'ready', size = 48, decorative = false }: { mood?: MossMood; size?: number; decorative?: boolean }) {
  const { settings } = useMoss();
  const clip = `moss-${useId().replace(/:/g, '')}`;
  const p = POSES[mood];
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': `${settings.name}, ${MOOD_WORDS[mood]}` };
  return (
    <svg
      viewBox="0 0 244 244"
      width={size}
      height={size}
      className={`moss-face moss-${mood}${settings.motion ? ' moss-moves' : ''}`}
      style={{ overflow: 'visible', flex: 'none' }}
      {...a11y}
    >
      <g transform={p.tilt ? `rotate(${p.tilt} 122 120)` : undefined}>
      <g className="moss-body">
        <ellipse cx={102} cy={210} rx={17} ry={11} fill={C.ink} />
        <ellipse cx={146} cy={210} rx={17} ry={11} fill={C.ink} />
        <ArmShape arm={p.left} outline />
        {p.handInFront ? null : <ArmShape arm={p.right} outline />}
        <path d={MOSS_BODY} fill={C.outline} stroke={C.outline} strokeWidth={12} strokeLinejoin="round" />
        <ArmShape arm={p.left} outline={false} />
        {p.handInFront ? null : (
          <g className="moss-wave">
            <ArmShape arm={p.right} outline={false} />
          </g>
        )}
        <clipPath id={clip}>
          <path d={MOSS_BODY} />
        </clipPath>
        <path d={MOSS_BODY} fill={C.ink} />
        <g clipPath={`url(#${clip})`}>
          <path d={MOSS_BELLY} fill={C.belly} />
          <path d={MOSS_BELLY_EDGE} fill={C.bellyLight} opacity={0.55} />
        </g>
        <g className="moss-eyes">
          <ellipse cx={104 + p.eyes.shift} cy={p.eyes.y} rx={9} ry={p.eyes.ry} fill={C.eye} />
          <ellipse cx={140 + p.eyes.shift} cy={p.eyes.y} rx={9} ry={p.eyes.ry} fill={C.eye} />
        </g>
        {p.smile ? (
          <path d={p.smile} fill="none" stroke={C.smile} strokeWidth={4.5} strokeLinecap="round" />
        ) : (
          <ellipse className="moss-mouth" cx={122} cy={127} rx={8} ry={6} fill={C.smile} />
        )}
        {p.dots.map((o, i) => (
          <circle key={i} className={`moss-dot moss-dot${i}`} cx={100 + 14 * i} cy={150} r={5.5} fill={C.dots[i]} opacity={o} />
        ))}
        {p.handInFront ? (
          <>
            <ArmShape arm={p.right} outline />
            <ArmShape arm={p.right} outline={false} />
          </>
        ) : null}
      </g>
      </g>
    </svg>
  );
}
