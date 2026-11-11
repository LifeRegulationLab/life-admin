import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { STORAGE_PREFIX } from '../brand';
import { accountsOn, backendFor, refreshPlan, syncNow, watchPlan, watchUser, type AccountUser } from '../account';
import { renewalsNeedingItems, roll } from '../logic/renewals';
import { DEFAULT_SETTINGS, type Item, type Renewal, type Settings } from '../model/types';
import type { Benefit, MoneyEntry } from '../model/money';
import { validBenefit, validEntry } from '../logic/money';
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
  benefits: Benefit[];
  money: MoneyEntry[];
  settings: Settings;
}

const EMPTY: Data = { items: [], renewals: [], benefits: [], money: [], settings: DEFAULT_SETTINGS };

export interface StoreValue {
  ready: boolean;
  user: AccountUser | null;
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
  saveBenefit: (b: Benefit) => Promise<void>;
  saveMoney: (entry: MoneyEntry) => Promise<void>;
  syncIssue: string;
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
  const [user, setUser] = useState<AccountUser | null>(null);
  const [authReady, setAuthReady] = useState(!accountsOn());
  const [held, setHeld] = useState<{ owner: Backend | null; data: Data; loaded: Set<string> }>({ owner: null, data: EMPTY, loaded: new Set() });
  const [syncIssue, setSyncIssue] = useState('');

  useEffect(() => {
    if (!accountsOn()) return;
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

  const uid = user?.uid;
  const backend: Backend = useMemo(() => (uid ? backendFor(uid, setSyncIssue) : device), [uid, device]);

  // With the shared account: when the signal comes back or the app comes to the front, send
  // what is waiting and fetch again. The Firebase store does this by itself.
  useEffect(() => {
    if (!uid) return;
    const front = () => {
      if (document.visibilityState === 'visible') syncNow();
    };
    window.addEventListener('online', syncNow);
    document.addEventListener('visibilitychange', front);
    return () => {
      window.removeEventListener('online', syncNow);
      document.removeEventListener('visibilitychange', front);
    };
  }, [uid]);

  useEffect(() => {
    const put = (change: Partial<Data>) =>
      setHeld((h) => {
        const same = h.owner === backend;
        return { owner: backend, data: { ...(same ? h.data : EMPTY), ...change }, loaded: new Set([...(same ? h.loaded : []), ...Object.keys(change)]) };
      });
    const unsubs = [
      backend.listen<Item>('items', (items) => put({ items })),
      backend.listen<Renewal>('renewals', (renewals) => put({ renewals })),
      backend.listen<Benefit>('benefits', (benefits) => put({ benefits })),
      backend.listen<MoneyEntry>('money', (money) => put({ money })),
      backend.listenDoc<Settings>('settings', (v) => put({ settings: { ...DEFAULT_SETTINGS, ...v } })),
    ];
    return () => unsubs.forEach((u) => u());
  }, [backend]);

  const data = held.owner === backend ? held.data : EMPTY;
  const loaded = held.owner === backend && held.loaded.size >= 5;

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
    void scheduleReminders(data.items, data.renewals, data.settings.reminders, data.settings.remindDays, data.benefits);
  }, [loaded, data.items, data.renewals, data.settings.reminders, data.settings.remindDays, data.benefits]);

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
    ready: authReady && loaded,
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
    saveBenefit: async (b) => {
      if (!validBenefit(b)) throw new Error('Check the benefit name, dates and amount.');
      await backend.save('benefits', b);
    },
    saveMoney: async (entry) => {
      if (!validEntry(entry)) throw new Error('Check the amount, date and description.');
      await backend.save('money', entry);
    },
    syncIssue,
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
