import { firebase, firebaseConfigured } from './firebase/app';
import { get, put } from './store/blobs';

/**
 * Read aloud in the app's recorded voice (calm, low, British). Each piece of text is fetched once
 * and kept on the device, so it plays straight away the next time and with no signal. New recordings
 * are part of Dealt With Plus. The phone's
 * own voice is used only if the person has chosen it in Me.
 */

const env = import.meta.env;

export function recordedVoiceAvailable(): boolean {
  return Boolean(env['VITE_SPEECH_URL']) && firebaseConfigured();
}

async function key(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

let player: HTMLAudioElement | undefined;
let listeners = new Set<(playing: boolean) => void>();

function tell(playing: boolean) {
  for (const l of listeners) l(playing);
}

export function onPlaying(l: (playing: boolean) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function stop(): void {
  if (player) {
    player.pause();
    player.src = '';
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  tell(false);
}

async function fetchVoice(text: string, plus: boolean): Promise<Blob | undefined> {
  const k = await key(text);
  const kept = await get('speech', k);
  if (kept) return kept;
  if (!recordedVoiceAvailable() || !plus) return undefined;
  const user = firebase().auth.currentUser;
  if (!user) return undefined;
  try {
    const res = await fetch(String(env['VITE_SPEECH_URL']), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${await user.getIdToken()}` },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    await put('speech', k, blob).catch(() => undefined);
    return blob;
  } catch {
    return undefined;
  }
}

export type SpeakResult = 'playing' | 'unavailable';

/**
 * Reads the text. New recordings need Dealt With Plus; ones already kept on the phone always play.
 * Returns 'unavailable' when there is no recorded voice and the phone's voice is not chosen.
 */
export async function speak(text: string, deviceVoice: boolean, plus = false): Promise<SpeakResult> {
  stop();
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 2500);
  if (!clean) return 'unavailable';
  const blob = await fetchVoice(clean, plus);
  if (blob) {
    player ??= new Audio();
    player.src = URL.createObjectURL(blob);
    player.onended = () => tell(false);
    player.onerror = () => tell(false);
    tell(true);
    await player.play().catch(() => tell(false));
    return 'playing';
  }
  if (deviceVoice && 'speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'en-GB';
    u.rate = 0.92;
    u.pitch = 0.9;
    u.onend = () => tell(false);
    tell(true);
    window.speechSynthesis.speak(u);
    return 'playing';
  }
  return 'unavailable';
}

/** For tests. */
export function resetSpeech(): void {
  listeners = new Set();
}
