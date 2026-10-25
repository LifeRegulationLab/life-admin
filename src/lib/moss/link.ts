import { STORAGE_PREFIX } from '../brand';

/**
 * Moss, the companion shared by the Life Regulation Lab apps.
 *
 * Here Moss is only a face and two settings (its name and whether it moves). Connecting Moss is
 * optional: the person types the email of their Mull or Pace account and the code sent to it.
 * That never makes a new account, never joins anything by email alone, and never touches this
 * app's own account. Nothing from letters, bills, forms or the helper is sent; only Moss's name
 * and the movement setting are read and written. What Moss remembers stays in Mull and Pace.
 */

/** show is for this device only and never sent. */
export type MossSettings = { name: string; motion: boolean; show: boolean };
export type MossLink = { email: string; access: string; refresh: string; expiresAt: number };

const SETTINGS_KEY = `${STORAGE_PREFIX}:moss`;
const LINK_KEY = `${STORAGE_PREFIX}:moss-link`;
export const DEFAULT_MOSS: MossSettings = { name: 'Moss', motion: true, show: true };

/** The shared Moss server. These are public client values, the same as in Mull and Pace. */
const SERVER = (import.meta.env['VITE_MOSS_URL'] as string | undefined) || 'https://xgeacgbeiivcbrgdfpbf.supabase.co';
const PUBLIC_KEY = (import.meta.env['VITE_MOSS_KEY'] as string | undefined) || 'sb_publishable_CSM1MLX5A8e-6L4ez-T5TA_laXLpi9t';

export function mossLinkAvailable(): boolean {
  return Boolean(SERVER && PUBLIC_KEY);
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Fetch = (url: string, init: RequestInit) => Promise<Response>;

function read<T>(store: Store, key: string): T | undefined {
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function cleanName(name: string): string {
  const n = name.replace(/\s+/g, ' ').trim().slice(0, 24);
  return n || DEFAULT_MOSS.name;
}

export class MossError extends Error {}

/** Settings on this device, and the optional link to the shared Moss. */
export class Moss {
  private listeners = new Set<() => void>();
  private settings: MossSettings;
  private link: MossLink | undefined;

  constructor(
    private store: Store,
    private send: Fetch = (url, init) => fetch(url, init),
    private now: () => number = () => Date.now(),
  ) {
    this.settings = { ...DEFAULT_MOSS, ...read<MossSettings>(store, SETTINGS_KEY) };
    this.link = read<MossLink>(store, LINK_KEY);
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };

  getSettings = () => this.settings;
  getLink = () => this.link;

  private changed() {
    for (const fn of this.listeners) fn();
  }

  private keep(settings: MossSettings) {
    this.settings = settings;
    this.store.setItem(SETTINGS_KEY, JSON.stringify(settings));
    this.changed();
  }

  private keepLink(link: MossLink | undefined) {
    this.link = link;
    if (link) this.store.setItem(LINK_KEY, JSON.stringify(link));
    else this.store.removeItem(LINK_KEY);
    this.changed();
  }

  private async auth(path: string, body: unknown, token?: string): Promise<Response> {
    let r: Response;
    try {
      r = await this.send(`${SERVER}/auth/v1/${path}`, {
        method: 'POST',
        headers: { apikey: PUBLIC_KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
    } catch {
      throw new MossError('Moss could not be reached. Check the signal and try again.');
    }
    return r;
  }

  /** Sends a six-digit code to the email of an existing Mull or Pace account. Never makes one. */
  async sendCode(email: string): Promise<void> {
    const r = await this.auth('otp', { email: email.trim(), create_user: false });
    if (r.ok) return;
    if (r.status === 422 || r.status === 400) throw new MossError('No Mull or Pace account uses that email. Moss can only be connected to one of those.');
    if (r.status === 429) throw new MossError('Too many codes asked for. Wait a minute and try again.');
    throw new MossError('The code was not sent. Try again in a minute.');
  }

  async confirmCode(email: string, code: string): Promise<void> {
    const r = await this.auth('verify', { email: email.trim(), token: code.replace(/\s/g, ''), type: 'email' });
    if (!r.ok) throw new MossError('That code did not work. Check it, or ask for a new one.');
    this.takeSession(email.trim(), await r.json());
    await this.pull();
  }

  private takeSession(email: string, v: { access_token?: string; refresh_token?: string; expires_in?: number }) {
    if (!v.access_token || !v.refresh_token) throw new MossError('Moss could not be connected. Try again.');
    this.keepLink({ email, access: v.access_token, refresh: v.refresh_token, expiresAt: this.now() + (v.expires_in ?? 3600) * 1000 });
  }

  private async token(): Promise<string | undefined> {
    const link = this.link;
    if (!link) return undefined;
    if (link.expiresAt - this.now() > 60_000) return link.access;
    const r = await this.send(`${SERVER}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: PUBLIC_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: link.refresh }),
    });
    if (r.status === 400 || r.status === 401) {
      // The Mull or Pace account was signed out everywhere or deleted. Keep the settings here.
      this.keepLink(undefined);
      return undefined;
    }
    if (!r.ok) return undefined;
    this.takeSession(link.email, await r.json());
    return this.link?.access;
  }

  private async rest(path: string, init: RequestInit): Promise<Response | undefined> {
    const token = await this.token();
    if (!token) return undefined;
    return this.send(`${SERVER}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    });
  }

  /** Reads the shared name and movement setting. Quietly does nothing when not connected or offline. */
  async pull(): Promise<void> {
    try {
      const r = await this.rest('moss_profiles?select=name,motion', { method: 'GET' });
      if (!r?.ok) return;
      const rows = (await r.json()) as Partial<MossSettings>[];
      const row = rows[0];
      if (!row) return;
      this.keep({ ...this.settings, name: cleanName(row.name ?? DEFAULT_MOSS.name), motion: row.motion ?? DEFAULT_MOSS.motion });
    } catch {
      // Offline: the settings on this device stand.
    }
  }

  /** Changes a setting here, and in the shared Moss when connected. */
  async update(change: Partial<MossSettings>): Promise<void> {
    const next = { ...this.settings, ...change };
    next.name = cleanName(next.name);
    this.keep(next);
    try {
      await this.rest('moss_profiles?on_conflict=user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ name: next.name, motion: next.motion, updated_at: new Date(this.now()).toISOString() }),
      });
    } catch {
      // Kept on this device; it goes up next time a setting changes.
    }
  }

  /** Disconnects Moss on this device only. The Mull or Pace account and its Moss are not touched. */
  async disconnect(): Promise<void> {
    const link = this.link;
    this.keepLink(undefined);
    if (!link) return;
    try {
      await this.auth('logout?scope=local', {}, link.access);
    } catch {
      // Already disconnected here; the server forgets the session when it runs out.
    }
  }
}

const memory = new Map<string, string>();
const fallback: Store = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => void memory.set(k, v),
  removeItem: (k) => void memory.delete(k),
};

function deviceStore(): Store {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // Private browsing with storage blocked.
  }
  return fallback;
}

export const moss = new Moss(deviceStore());
