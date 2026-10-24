import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Card, Choice, Field, Page, Text } from '../components/ui';
import { ReadAloud } from '../components/voice';
import { APP_FULL_NAME, APP_NAME } from '../lib/brand';
import { firebaseConfigured } from '../lib/firebase/app';
import { deleteEverything, openBilling, signOut } from '../lib/firebase/account';
import { helperAvailable } from '../lib/helper/client';
import type { ReadAloud as ReadAloudSetting, Settings, TextSize } from '../lib/model/types';
import { saveFile } from '../lib/shell';
import { recordedVoiceAvailable } from '../lib/speech';
import { COLLECTIONS, DOCS } from '../lib/store/backend';
import { clear } from '../lib/store/blobs';
import { useStore } from '../lib/store/StoreProvider';

const SIZES: { code: TextSize; text: string }[] = [
  { code: 'normal', text: 'Normal' },
  { code: 'large', text: 'Large' },
  { code: 'larger', text: 'Larger' },
];

const READ: { code: ReadAloudSetting; text: string }[] = [
  { code: 'off', text: 'Off' },
  { code: 'button', text: 'A button on each screen' },
  { code: 'every', text: 'Read every screen' },
];

/** The person's own settings, the account, and leaving. */
export function Me() {
  const { data, saveSettings, user, device, saveItem, saveRenewal, plus, paid } = useStore();
  const [billingNote, setBillingNote] = useState('');
  const thanks = new URLSearchParams(window.location.search).get('plus') === 'thanks';
  const onSale = Boolean(import.meta.env['VITE_CHECKOUT_URL']);
  const billing = (which: 'checkout' | 'portal') => void openBilling(which).then((e) => setBillingNote(e ?? ''));
  const navigate = useNavigate();
  const s = data.settings;
  const [name, setName] = useState(s.name);
  const [address, setAddress] = useState(s.address);
  const [sure, setSure] = useState<'' | 'device' | 'account'>('');
  const [msg, setMsg] = useState('');
  const set = (change: Partial<Settings>) => void saveSettings({ ...s, ...change });

  const exportAll = async () => {
    const body = JSON.stringify({ app: APP_FULL_NAME, exportedAt: new Date().toISOString(), items: data.items, renewals: data.renewals, settings: data.settings }, null, 2);
    await saveFile(`${APP_NAME.toLowerCase().replace(/\s+/g, '-')}-export.json`, new TextEncoder().encode(body), 'application/json');
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const v = JSON.parse(await file.text()) as { items?: unknown; renewals?: unknown };
      const items = Array.isArray(v.items) ? (v.items as typeof data.items) : [];
      const renewals = Array.isArray(v.renewals) ? (v.renewals as typeof data.renewals) : [];
      for (const i of items) if (i && typeof i.id === 'string') await saveItem(i);
      for (const r of renewals) if (r && typeof r.id === 'string') await saveRenewal(r);
      setMsg(`Brought in ${items.length} things and ${renewals.length} renewals.`);
    } catch {
      setMsg('That file could not be read. It needs to be an export from this app.');
    }
  };

  const clearDevice = async () => {
    device.clear([...COLLECTIONS, ...DOCS.map((d) => `doc:${d}`)]);
    await clear('photos');
    await clear('speech');
    setSure('');
    navigate('/');
  };

  const deleteAccount = async () => {
    if (!user) return;
    try {
      await deleteEverything(user);
      await clear('photos');
      await clear('speech');
      navigate('/');
    } catch {
      setMsg('The account was not deleted. For safety, sign out and sign in again, then try once more.');
    }
  };

  return (
    <Page title="Me">
      <ReadAloud text="Your settings. Your name, easy-read, text size, read aloud, and your account." auto={false} />
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">For your replies</h2>
        <Text label="Your name" value={name} onChange={setName} />
        <Field label="Your address" hint="Put at the top of letters you write. Optional.">
          <textarea className="field" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <button type="button" className="btn self-start" disabled={name === s.name && address === s.address} onClick={() => set({ name, address })}>
          Save
        </button>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold">Reading</h2>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={s.easyRead} onChange={(e) => set({ easyRead: e.target.checked })} />
          <span>Easy-read: shorter sentences and bigger pictures</span>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={s.pictures} onChange={(e) => set({ pictures: e.target.checked })} />
          <span>Show pictures beside things</span>
        </label>
        <Choice label="Text size" options={SIZES} value={s.textSize} onChange={(v) => set({ textSize: v })} />
        <Choice label="Read aloud" options={READ} value={s.readAloud} onChange={(v) => set({ readAloud: v })} />
        <p className="muted text-sm">
          {!recordedVoiceAvailable()
            ? 'The recorded voice is not switched on in this version.'
            : plus
              ? 'Read aloud uses a calm recorded voice. It needs a signal the first time each screen is read.'
              : 'The calm recorded voice is part of Dealt With Plus. Screens already recorded on this phone still play.'}
        </p>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={s.deviceVoice} onChange={(e) => set({ deviceVoice: e.target.checked })} />
          <span>When the recorded voice cannot be reached, use this phone’s own voice</span>
        </label>
      </Card>

      {firebaseConfigured() && (onSale || plus) ? (
        <div id="plus">
          <Card className="flex flex-col gap-3">
            <h2 className="font-semibold">Dealt With Plus</h2>
            {plus ? (
              <>
                <p>You have Plus{paid ? '' : ' while you test the app'}. The helper and the recorded voice are open to you.</p>
                {paid ? (
                  <button type="button" className="btn self-start" onClick={() => billing('portal')}>
                    Change card or cancel Plus
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <p>Plus adds the helper, which explains letters in plain words, drafts replies, writes call scripts and answers questions. It also adds the calm recorded voice for read aloud.</p>
                <p className="muted text-sm">Paid monthly, cancel any time. Everything else in the app stays free.</p>
                {user ? (
                  <button type="button" className="btn btn-primary self-start" onClick={() => billing('checkout')}>
                    Get Plus
                  </button>
                ) : (
                  <Link to="/signin" className="btn btn-primary self-start">
                    Make an account first
                  </Link>
                )}
              </>
            )}
            {billingNote ? <p className="warnbox">{billingNote}</p> : null}
            {thanks && !plus ? <p className="muted text-sm">Payment done. Plus switches on within a minute.</p> : null}
          </Card>
        </div>
      ) : null}

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">Reminders and the helper</h2>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={s.reminders} onChange={(e) => set({ reminders: e.target.checked })} />
          <span>Remind me three days before a date, on the day, and when it is time to chase</span>
        </label>
        {helperAvailable() && plus ? (
          <>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={s.helperOn} onChange={(e) => set({ helperOn: e.target.checked })} />
              <span>Use the helper to explain letters and draft replies</span>
            </label>
            <p className="muted text-sm">When you press Explain or Draft, the words of that one thing are sent to be read, then forgotten. Nothing else is sent. Every step works without it.</p>
          </>
        ) : null}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">Account</h2>
        {!firebaseConfigured() ? (
          <p>Everything is kept on this phone. Accounts are not switched on in this version.</p>
        ) : user ? (
          <>
            <p>Signed in as {user.email}. Your things follow you to a new phone.</p>
            <p className="muted text-sm">This account is for {APP_NAME} only. Your other Life Regulation Lab apps have their own, and are not affected by anything you do here.</p>
            <button type="button" className="btn self-start" onClick={() => void signOut()}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <p>You are looking around. What you add is kept on this phone only. An account keeps it safe if you lose or change the phone, and lets someone help with one step by link.</p>
            <Link to="/signin" className="btn btn-primary self-start">
              Make an account or sign in
            </Link>
          </>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">Your records</h2>
        <button type="button" className="btn self-start" onClick={() => void exportAll()}>
          Save a copy of everything
        </button>
        <label className="btn self-start">
          Bring in a copy
          <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void importFile(e.target.files?.[0])} />
        </label>
        <p className="muted text-sm">Photos stay on this phone and are not in the copy.</p>
        {msg ? <p>{msg}</p> : null}
        {sure === '' ? (
          <div className="flex flex-wrap gap-2">
            {user ? (
              <button type="button" className="btn btn-warn" onClick={() => setSure('account')}>
                Delete my account
              </button>
            ) : (
              <button type="button" className="btn btn-warn" onClick={() => setSure('device')}>
                Delete everything on this phone
              </button>
            )}
          </div>
        ) : (
          <div className="warnbox flex flex-col gap-2">
            <p>
              {sure === 'account'
                ? `This deletes your ${APP_NAME} account and everything in it. Your other Life Regulation Lab apps are not touched. It cannot be undone. Save a copy first if you want one.${paid ? ' Cancel Plus first, using "Change card or cancel Plus" above, so the payments stop.' : ''}`
                : 'This deletes everything this app keeps on this phone. It cannot be undone. Save a copy first if you want one.'}
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-warn" onClick={() => void (sure === 'account' ? deleteAccount() : clearDevice())}>
                Delete it
              </button>
              <button type="button" className="btn" onClick={() => setSure('')}>
                Keep it
              </button>
            </div>
          </div>
        )}
      </Card>
      <p className="muted text-sm">{APP_FULL_NAME}. It explains and organises; it is not legal or financial advice.</p>
    </Page>
  );
}
