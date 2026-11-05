/**
 * Glow Moss: a living ball of light with a simple glowing face. Drawn on a canvas, the same drawing as
 * Mull's Coach/Moss.swift (MossDrawing). The surface ripples while listening, light swirls inside and
 * four dots circle it while thinking, and rings pulse out while speaking. It glides between states with
 * a small hop and gives a happy squish when tapped. With movement off it holds one still frame.
 */
export type GlowMood = 'ready' | 'listening' | 'thinking' | 'speaking';

export type GlowFrame = {
  mood: GlowMood;
  previous: GlowMood;
  /** Seconds, on the same clock as `time`. */
  changedAt: number;
  pokedAt: number;
  time: number;
  moving: boolean;
};

/** The drawing's box, with the ball in the middle and room around it. */
export const GLOW_BOX = 300;
/** The canvas reaches past the box by this much on each side, so the halo fades out instead of being cut. */
export const GLOW_BLEED = 60;

const R = 92;
const TAU = Math.PI * 2;
const DOTS = ['#598E94', '#5EA79C', '#90D1BD', '#B4EBD4'];
const FACE = '#F2FFFA';

type Weights = Record<GlowMood, number>;

const clamp = (v: number, lo = 0, hi = 1) => Math.min(Math.max(v, lo), hi);
const mint = (a: number) => `rgba(144,209,189,${a.toFixed(3)})`;
const glow = (a: number) => `rgba(180,235,212,${a.toFixed(3)})`;

/** A steady number between 0 and 1 for a whole number, so blinks and glances vary without randomness. */
function noise(n: number) {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

function only(mood: GlowMood): Weights {
  return { ready: 0, listening: 0, thinking: 0, speaking: 0, [mood]: 1 };
}

/** How much of each state is showing, easing from the last state to this one. */
function weights(f: GlowFrame): Weights {
  const p = f.moving ? clamp((f.time - f.changedAt) / 0.5) : 1;
  if (p >= 1) return only(f.mood);
  const k = p * p * (3 - 2 * p);
  const a = only(f.previous);
  const b = only(f.mood);
  return {
    ready: a.ready + (b.ready - a.ready) * k,
    listening: a.listening + (b.listening - a.listening) * k,
    thinking: a.thinking + (b.thinking - a.thinking) * k,
    speaking: a.speaking + (b.speaking - a.speaking) * k,
  };
}

/** The speech level while speaking: syllables with short pauses. */
function talkLevel(f: GlowFrame) {
  if (!f.moving) return 0.5;
  const level = clamp(0.5 + 0.5 * (Math.sin(f.time * 13) * 0.6 + Math.sin(f.time * 7.3 + 1) * 0.4));
  return Math.sin(f.time * 1.7) < -0.6 ? level * 0.15 : level;
}

/** How strongly the surface answers while listening. */
function voiceLevel(f: GlowFrame) {
  if (!f.moving) return 0.5;
  const level = clamp(0.5 + 0.5 * (Math.sin(f.time * 9.1) * 0.5 + Math.sin(f.time * 5.7 + 2) * 0.5));
  return Math.sin(f.time * 1.3 + 1) < -0.5 ? level * 0.2 : level;
}

/** 1 for a moment after a tap. */
function happyLevel(f: GlowFrame) {
  if (!f.moving) return 0;
  const d = f.time - f.pokedAt;
  if (d < 0 || d >= 1) return 0;
  return Math.min(1, d / 0.08) * Math.min(1, (1 - d) / 0.15);
}

/** A lift and the squash as Moss settles, for a state change or a tap. */
function hop(time: number, start: number, height: number) {
  const p = (time - start) / 0.45;
  let lift = 0;
  let stretch = 0;
  let squash = 0;
  if (p >= 0 && p < 1) {
    lift = Math.sin(Math.PI * p) * height;
    stretch = 0.06 * Math.sin(Math.PI * p) * height;
  }
  const land = time - start - 0.45;
  if (land > 0 && land < 1.2) squash = 0.08 * height * Math.exp(-land * 7) * Math.cos(land * 20);
  return { lift, stretch, squash };
}

function blinkLevel(f: GlowFrame) {
  if (!f.moving) return 1;
  const slot = Math.floor(f.time / 3.1);
  const jitter = noise(slot);
  const at = slot * 3.1 + jitter * 2.4;
  for (const d of [f.time - at, jitter > 0.78 ? f.time - at - 0.3 : -1]) {
    if (d >= 0 && d < 0.18) return Math.max(0.06, 1 - Math.sin((Math.PI * d) / 0.18));
  }
  return 1;
}

/** Where the face points, from -1 to 1: glancing around while ready, up and across while thinking. */
function look(f: GlowFrame, w: Weights) {
  let gx = 0;
  let gy = 0;
  if (f.moving) {
    const target = (slot: number) => ({ x: (noise(slot) * 2 - 1) * 0.9, y: (noise(slot + 0.5) * 2 - 1) * 0.5 });
    const slot = Math.floor(f.time / 2.6);
    const k = clamp((f.time - slot * 2.6) / 0.4);
    const s = k * k * (3 - 2 * k);
    const a = target(slot - 1);
    const b = target(slot);
    gx = a.x + (b.x - a.x) * s;
    gy = a.y + (b.y - a.y) * s;
  }
  return { x: gx * w.ready + 0.75 * w.thinking, y: gy * w.ready + 0.15 * w.listening - 0.8 * w.thinking };
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  const r = Math.min(width, height) / 2;
  ctx.beginPath();
  if (height >= width) {
    ctx.arc(x + r, y + r, r, Math.PI, 0);
    ctx.arc(x + r, y + height - r, r, 0, Math.PI);
  } else {
    ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2);
    ctx.arc(x + width - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  }
  ctx.closePath();
}

/** Draws one frame. `size` is the canvas's side in the context's own units. */
export function drawGlow(ctx: CanvasRenderingContext2D, size: number, f: GlowFrame) {
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  const scale = size / (GLOW_BOX + GLOW_BLEED * 2);
  ctx.scale(scale, scale);
  ctx.translate(GLOW_BLEED, GLOW_BLEED);

  const t = f.moving ? f.time : 0;
  const m = f.moving ? 1 : 0;
  const w = weights(f);
  const talk = talkLevel(f);
  const voice = voiceLevel(f);
  const happy = happyLevel(f);

  const change = hop(f.time, f.changedAt, f.moving && f.previous !== f.mood ? 0.5 : 0);
  const poke = hop(f.time, f.pokedAt, f.moving ? 1 : 0);
  const cx = GLOW_BOX / 2;
  const cy = 146 + m * Math.sin((t * TAU) / 3.6) * R * 0.06 - (change.lift + poke.lift) * R * 0.3;
  const stretch = change.stretch + poke.stretch;
  const squash = change.squash + poke.squash;
  const sx = 1 + squash - stretch * 0.5;
  const sy = 1 - squash + stretch;
  const pulse = f.moving ? 0.5 + 0.5 * Math.sin((t * TAU) / 4) : 0.5;

  // The soft glow around Moss.
  const halo = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 2.1);
  halo.addColorStop(0, mint(0.28 + 0.12 * pulse + 0.15 * w.speaking * talk));
  halo.addColorStop(1, mint(0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 2.1, 0, TAU);
  ctx.fill();

  // Rings: pulsing out while speaking, drawing in while listening.
  if (f.moving) {
    for (let i = 0; i < 3; i++) {
      if (w.speaking > 0.02) {
        const p = (t * 0.8 + i / 3) % 1;
        ctx.beginPath();
        ctx.arc(cx, cy, R * (1.05 + 0.7 * p), 0, TAU);
        ctx.strokeStyle = glow(w.speaking * (1 - p) * 0.55 * (0.4 + 0.6 * talk));
        ctx.lineWidth = R * 0.025;
        ctx.stroke();
      }
      if (w.listening > 0.02) {
        const q = (t * 0.7 + i / 3) % 1;
        ctx.beginPath();
        ctx.arc(cx, cy, R * (1.75 - 0.6 * q), 0, TAU);
        ctx.strokeStyle = glow(w.listening * q * 0.4);
        ctx.lineWidth = R * 0.02;
        ctx.stroke();
      }
    }
  }

  // The ball, its edge gently rippling.
  const ripple = 0.012 + 0.04 * w.listening * voice + 0.05 * w.speaking * talk + 0.012 * w.thinking + 0.07 * happy;
  const ball = () => {
    ctx.beginPath();
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * TAU;
      const k = 1 + ripple * (Math.sin(3 * a + 1.3 * t) * 0.55 + Math.sin(5 * a - 1.9 * t) * 0.3 + Math.sin(2 * a + 0.8 * t) * 0.4);
      const x = cx + R * k * Math.cos(a) * sx;
      const y = cy + R * k * Math.sin(a) * sy + R * (1 - sy);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  ctx.save();
  ctx.shadowColor = mint(0.75);
  ctx.shadowBlur = R * (0.35 + 0.15 * pulse) * scale;
  ball();
  const skin = ctx.createRadialGradient(cx - R * 0.32, cy - R * 0.38, R * 0.05, cx, cy, R * 1.1);
  skin.addColorStop(0, '#86D6C4');
  skin.addColorStop(0.35, '#3E928C');
  skin.addColorStop(0.75, '#1D4B55');
  skin.addColorStop(1, '#12303A');
  ctx.fillStyle = skin;
  ctx.fill();
  ctx.restore();

  // Inside the ball: slow light, the swirl while thinking, and the shine.
  ctx.save();
  ball();
  ctx.clip();
  for (let i = 0; i < 3; i++) {
    const a = t * (0.3 + i * 0.13) + i * 2;
    const x = cx + Math.cos(a) * R * 0.4;
    const y = cy + Math.sin(a * 1.3) * R * 0.35;
    const light = ctx.createRadialGradient(x, y, 0, x, y, R * 0.6);
    light.addColorStop(0, glow(0.12 + 0.1 * w.listening * voice));
    light.addColorStop(1, glow(0));
    ctx.fillStyle = light;
    ctx.fillRect(cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6);
  }
  if (w.thinking > 0.02) {
    ctx.fillStyle = `rgba(242,255,250,${(w.thinking * 0.75).toFixed(3)})`;
    for (let i = 0; i < 16; i++) {
      const a = t * 1.7 + (i * TAU) / 16 + Math.sin(t + i) * 0.3;
      const r = R * (0.45 + 0.32 * Math.sin(i * 1.7 + t * 0.9));
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.85, R * 0.028, 0, TAU);
      ctx.fill();
    }
  }
  const shine = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.5, 0, cx - R * 0.4, cy - R * 0.5, R * 0.5);
  shine.addColorStop(0, 'rgba(255,255,255,0.4)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6);
  ctx.restore();
  ball();
  ctx.strokeStyle = 'rgba(205,239,227,0.55)';
  ctx.lineWidth = R * 0.02;
  ctx.stroke();

  // The face, which slides across the ball as Moss looks around.
  const gaze = look(f, w);
  const fore = 1 - Math.abs(gaze.x) * 0.15;
  const fx = cx + gaze.x * R * 0.18;
  const fy = cy - R * 0.06 + gaze.y * R * 0.14;
  ctx.save();
  ctx.shadowColor = 'rgba(180,235,212,0.95)';
  ctx.shadowBlur = R * 0.2 * scale;
  ctx.fillStyle = FACE;
  ctx.strokeStyle = FACE;
  ctx.lineCap = 'round';
  const ew = R * 0.11 * fore;
  const eh = Math.max(R * 0.02, R * 0.27 * (1 + 0.12 * w.listening - 0.22 * w.thinking) * blinkLevel(f));
  const gap = R * 0.36 * fore;
  for (const side of [-1, 1]) {
    const ex = fx + (side * gap) / 2;
    if (happy > 0.45) {
      ctx.beginPath();
      ctx.moveTo(ex - ew * 1.1, fy + R * 0.04);
      ctx.quadraticCurveTo(ex, fy - R * 0.12, ex + ew * 1.1, fy + R * 0.04);
      ctx.lineWidth = R * 0.07;
      ctx.stroke();
    } else {
      pill(ctx, ex - ew / 2, fy - eh / 2, ew, eh);
      ctx.fill();
    }
  }
  const my = fy + R * 0.26;
  ctx.lineWidth = R * 0.045;
  if (w.speaking > 0.5 && happy < 0.5) {
    const mh = R * (0.02 + 0.09 * talk);
    pill(ctx, fx - R * 0.07, my - mh / 2, R * 0.14, mh);
    ctx.fill();
  } else if (w.thinking > 0.5) {
    ctx.beginPath();
    ctx.moveTo(fx - R * 0.03, my);
    ctx.lineTo(fx + R * 0.07, my - R * 0.01);
    ctx.stroke();
  } else {
    const sw = R * (0.08 + 0.04 * happy);
    ctx.beginPath();
    ctx.moveTo(fx - sw, my - R * 0.01);
    ctx.quadraticCurveTo(fx, my + R * (0.05 + 0.05 * happy), fx + sw, my - R * 0.01);
    ctx.stroke();
  }
  ctx.restore();

  // The four dots from Mull's icon: under the face, or circling Moss while it thinks.
  DOTS.forEach((colour, i) => {
    ctx.save();
    ctx.fillStyle = colour;
    ctx.shadowColor = colour;
    ctx.shadowBlur = R * 0.12 * scale;
    ctx.beginPath();
    if (w.thinking > 0.5) {
      const a = t * 1.8 - i * 0.45;
      ctx.globalAlpha = w.thinking * (Math.sin(a) > -0.2 ? 1 : 0.45);
      ctx.arc(cx + Math.cos(a) * R * 1.28, cy + Math.sin(a) * R * 0.42 - R * 0.05, R * 0.045, 0, TAU);
    } else {
      let opacity = 1;
      let rise = 0;
      if (f.mood === 'ready') opacity = f.moving ? 0.8 + 0.2 * Math.sin(t * 2 - i * 0.7) : 1;
      if (f.mood === 'listening') opacity = f.moving ? 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.6)) : 0.75;
      if (f.mood === 'speaking' && f.moving) rise = R * 0.06 * clamp(talk * (0.6 + 0.4 * Math.sin(t * (9 + i * 2.3) + i)));
      ctx.globalAlpha = opacity;
      ctx.arc(fx + (i - 1.5) * R * 0.13, fy + R * 0.52 - rise, R * 0.042, 0, TAU);
    }
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();
}
