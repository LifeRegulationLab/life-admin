import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { STORAGE_PREFIX } from '../brand';
import { firebase, firebaseConfigured } from '../firebase/app';
import { refreshPlan, watchPlan, watchUser } from '../firebase/account';
import { SharedBackend } from '../firebase/shared';
import { renewalsNeedingItems, roll } from '../logic/renewals';
import { DEFAULT_SETTINGS, type Item, type Renewal, type Settings } from '../model/types';
import { scheduleReminders } from '../reminders';
import type { Backend } from './backend';
import { deviceStorage, LocalBackend } from './local';

/**
 * One place for everything on screen. Before an account, records stay on this device. With an
 * account, they live in this app's own database and the device keeps a copy for when there is no signal.
 */

export const DEVICE_PREFIX = `${STORAGE_PREFIX}:device`;

export interface Data {
  items: Item[];
  renewals: Renewal[];
  settings: Settings;
}

const EMPTY: Data = { items: [], renewals: [], settings: DEFAULT_SETTINGS };

export interface StoreValue {
  ready: boolean;
  user: User | null;
  data: Data;
  backend: Backend;
  device: LocalBackend;
  /** Has Dealt With Plus, which opens the helper and the recorded voice. The server checks again on every call. */
  plus: boolean;
  /** Pays for Plus through Stripe (testers have Plus without paying). */
  paid: boolean;
  saveItem: (item: Item) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  saveRenewal: (r: Renewal) => Promise<void>;
  removeRenewal: (id: string) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  /** The last change that can be taken back, shown as an Undo bar for a short while. */
  undo: { label: string; at: number } | undefined;
  /** Remembers how a thing was before a change, so Undo can put it back. */
  offerUndo: (label: string, before: Item) => void;
  /** Puts the thing back as it was, and returns its id. */
  runUndo: () => Promise<string | undefined>;
  clearUndo: () => void;
  /** Goes up by one each time Undo is used, so open screens start again from the restored thing. */
  undoTick: number;
}

const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const device = useMemo(() => new LocalBackend(DEVICE_PREFIX, deviceStorage()), []);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!firebaseConfigured());
  const [held, setHeld] = useState<{ owner: Backend | null; data: Data; loaded: number }>({ owner: null, data: EMPTY, loaded: 0 });

  useEffect(() => {
    if (!firebaseConfigured()) return;
    return watchUser((u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  const [plan, setPlan] = useState<{ uid: string; active: boolean; paid: boolean } | undefined>();
  useEffect(() => {
    if (!user) return;
    void refreshPlan();
    return watchPlan(user.uid, (p) => setPlan({ uid: user.uid, ...p }));
  }, [user]);
  const ownPlan = user && plan?.uid === user.uid ? plan : undefined;

  const backend: Backend = useMemo(() => (user ? new SharedBackend(firebase().db, user.uid) : device), [user, device]);

  useEffect(() => {
    const put = (change: Partial<Data>) =>
      setHeld((h) => {
        const same = h.owner === backend;
        return { owner: backend, data: { ...(same ? h.data : EMPTY), ...change }, loaded: (same ? h.loaded : 0) + 1 };
      });
    const unsubs = [
      backend.listen<Item>('items', (items) => put({ items })),
      backend.listen<Renewal>('renewals', (renewals) => put({ renewals })),
      backend.listenDoc<Settings>('settings', (v) => put({ settings: { ...DEFAULT_SETTINGS, ...v } })),
    ];
    return () => unsubs.forEach((u) => u());
  }, [backend]);

  const data = held.owner === backend ? held.data : EMPTY;
  const loaded = held.owner === backend && held.loaded >= 3;

  // Renewals turn into something to deal with when their date is near.
  const made = useRef(new Set<string>());
  useEffect(() => {
    if (!loaded) return;
    for (const item of renewalsNeedingItems(data.renewals, data.items)) {
      if (!item.renewalId || made.current.has(item.renewalId)) continue;
      made.current.add(item.renewalId);
      const r = data.renewals.find((x) => x.id === item.renewalId);
      void backend.save('items', item);
      if (r) void backend.save('renewals', { ...r, itemId: item.id });
    }
  }, [loaded, data.renewals, data.items, backend]);

  useEffect(() => {
    if (!loaded) return;
    void scheduleReminders(data.items, data.renewals, data.settings.reminders, data.settings.remindDays);
  }, [loaded, data.items, data.renewals, data.settings.reminders, data.settings.remindDays]);

  useEffect(() => {
    const root = document.documentElement;
    if (data.settings.textSize === 'normal') delete root.dataset['text'];
    else root.dataset['text'] = data.settings.textSize;
    root.dataset['easy'] = data.settings.easyRead ? 'on' : 'off';
    root.dataset['contrast'] = data.settings.contrast ? 'on' : 'off';
    root.dataset['spacing'] = data.settings.wideSpacing ? 'wide' : 'normal';
  }, [data.settings.textSize, data.settings.easyRead, data.settings.contrast, data.settings.wideSpacing]);

  const [undoState, setUndoState] = useState<{ label: string; at: number; before: Item } | undefined>();
  const [undoTick, setUndoTick] = useState(0);

  const value: StoreValue = {
    ready: authReady,
    user,
    data,
    backend,
    device,
    plus: Boolean(ownPlan?.active),
    paid: Boolean(ownPlan?.paid),
    saveItem: async (item) => {
      await backend.save('items', item);
      // A renewal moves on to its next date once its item is dealt with.
      if (item.status === 'done' && item.renewalId) {
        const r = data.renewals.find((x) => x.id === item.renewalId);
        if (r && r.itemId === item.id) {
          const next = roll(r, item.doneAt ?? Date.now());
          if (next) {
            made.current.delete(r.id);
            await backend.save('renewals', next);
          } else await backend.remove('renewals', r.id);
        }
      }
    },
    removeItem: (id) => backend.remove('items', id),
    saveRenewal: (r) => backend.save('renewals', r),
    removeRenewal: (id) => backend.remove('renewals', id),
    saveSettings: (s) => backend.saveDoc('settings', s),
    undo: undoState ? { label: undoState.label, at: undoState.at } : undefined,
    offerUndo: (label, before) => setUndoState({ label, at: Date.now(), before }),
    runUndo: async () => {
      if (!undoState) return undefined;
      setUndoState(undefined);
      await backend.save('items', { ...undoState.before, updatedAt: Date.now() });
      setUndoTick((t) => t + 1);
      return undoState.before.id;
    },
    clearUndo: () => setUndoState(undefined),
    undoTick,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}

export function useSettings(): Settings {
  return useStore().data.settings;
}
