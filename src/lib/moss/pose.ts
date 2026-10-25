/**
 * How Moss looks in each state. Moss shows what the app is doing, never a guessed feeling:
 * ready (nothing running), listening (taking in words), thinking (the helper is working),
 * speaking (read aloud is playing). Drawn on a 244 by 244 grid, the same as Mull and Pace.
 */
export type MossMood = 'ready' | 'listening' | 'thinking' | 'speaking';

export const MOSS_MOODS: MossMood[] = ['ready', 'listening', 'thinking', 'speaking'];

export const MOSS_COLOURS = {
  ink: '#1C3740',
  outline: '#CDEFE3',
  belly: '#67B3A7',
  bellyLight: '#90D1BD',
  eye: '#E7F8F0',
  smile: '#BEEDDD',
  dots: ['#598E94', '#5EA79C', '#90D1BD', '#B4EBD4'],
} as const;

export const MOSS_BODY =
  'M122 22 C176 22 212 60 212 112 C212 164 176 198 126 200 L94 200 C86 210 74 220 60 224 C66 214 68 204 66 194 C42 178 32 148 32 112 C32 60 70 22 122 22 Z';
export const MOSS_BELLY = 'M20 180 C80 160 140 192 224 162 L224 240 L20 240 Z';
export const MOSS_BELLY_EDGE = 'M20 180 C80 160 140 192 224 162 L224 172 C140 202 80 172 20 192 Z';

/** An arm: centre, the inner size (the outline is 4 larger all round) and its turn in degrees. */
export type Arm = { x: number; y: number; rx: number; ry: number; turn: number };

export type Pose = {
  tilt: number;
  left: Arm;
  right: Arm;
  /** The right hand is drawn in front of the body (thinking: hand to chin). */
  handInFront: boolean;
  eyes: { y: number; ry: number; shift: number };
  /** A smile path, or undefined when the mouth is open (speaking). */
  smile?: string;
  dots: number[];
};

const LEFT: Arm = { x: 34, y: 150, rx: 13, ry: 22, turn: 25 };

export const POSES: Record<MossMood, Pose> = {
  ready: {
    tilt: 0,
    left: LEFT,
    right: { x: 214, y: 112, rx: 13, ry: 22, turn: 35 },
    handInFront: false,
    eyes: { y: 96, ry: 14, shift: 0 },
    smile: 'M108 124 Q122 136 136 124',
    dots: [1, 1, 1, 1],
  },
  listening: {
    tilt: -4,
    left: { x: 30, y: 132, rx: 13, ry: 22, turn: 60 },
    right: { x: 210, y: 150, rx: 13, ry: 22, turn: -25 },
    handInFront: false,
    eyes: { y: 96, ry: 15, shift: 0 },
    smile: 'M112 125 Q122 132 132 125',
    dots: [0.75, 0.75, 0.75, 0.75],
  },
  thinking: {
    tilt: 0,
    left: LEFT,
    right: { x: 172, y: 132, rx: 10, ry: 16, turn: -50 },
    handInFront: true,
    eyes: { y: 92, ry: 13, shift: 4 },
    smile: 'M114 125 Q123 131 132 124',
    dots: [1, 0.55, 0.35, 0.25],
  },
  speaking: {
    tilt: 0,
    left: LEFT,
    right: { x: 210, y: 150, rx: 13, ry: 22, turn: -25 },
    handInFront: false,
    eyes: { y: 96, ry: 14, shift: 0 },
    dots: [1, 1, 1, 1],
  },
};
