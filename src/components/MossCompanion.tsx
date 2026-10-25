import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Moss, useMoss } from './Moss';
import { moss } from '../lib/moss/link';

/** One plain thing Moss can open from where it is: a page of this app, nothing new. */
export type MossAction = { label: string; detail: string; to?: string; run?: () => void };

const ACTION = 'moss-action';
const QUIET = 'btn';

/**
 * Moss's sheet: the face, a few things it can open here, and a way to hide it. A native dialog,
 * so it traps focus, closes with Escape and is read as a dialog.
 */
function MossSheet({ onClose, actions, settingsTo }: { onClose: () => void; actions: MossAction[]; settingsTo: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { settings } = useMoss();
  // Only in the page while open, so a closed sheet adds nothing for screen readers or search.
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
  }, []);
  return (
    <dialog ref={ref} className="moss-sheet" aria-label={settings.name} onClose={onClose}>
      <div className="flex flex-col items-center gap-3">
        <Moss size={104} />
        <h2 className="text-xl font-semibold">What would help?</h2>
        <ul className="flex w-full flex-col gap-2">
          {actions.map((a) => (
            <li key={a.label}>
              {a.to !== undefined ? (
                <Link to={a.to} className={ACTION} onClick={() => { onClose(); a.run?.(); }}>
                  <span className="font-semibold">{a.label}</span>
                  <span className="muted text-sm">{a.detail}</span>
                </Link>
              ) : (
                <button type="button" className={ACTION} onClick={() => { onClose(); a.run?.(); }}>
                  <span className="font-semibold">{a.label}</span>
                  <span className="muted text-sm">{a.detail}</span>
                </button>
              )}
            </li>
          ))}
          <li>
            <Link to={settingsTo} className={ACTION} onClick={onClose}>
              <span className="font-semibold">Settings for {settings.name}</span>
              <span className="muted text-sm">Show, movement and name</span>
            </Link>
          </li>
        </ul>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className={QUIET} onClick={onClose}>
            Close
          </button>
          <button type="button" className={QUIET} onClick={() => { onClose(); void moss.update({ show: false }); }}>
            Hide {settings.name}
          </button>
        </div>
        <p className="muted text-center text-xs">You can bring {settings.name} back in Settings.</p>
      </div>
    </dialog>
  );
}

/** Moss in the middle of the home page. Tapping it opens Moss's sheet. */
export function MossHome({ actions, settingsTo, line }: { actions: MossAction[]; settingsTo: string; line?: string }) {
  const { settings } = useMoss();
  const [open, setOpen] = useState(false);
  if (!settings.show) return null;
  return (
    <div className="mb-6 flex flex-col items-center gap-1 text-center">
      <button type="button" className="moss-home" aria-label={`${settings.name}. What would help?`} onClick={() => setOpen(true)}>
        <Moss size={112} decorative />
      </button>
      <p className="muted text-sm">{line ?? `Tap ${settings.name} for help with what to do next.`}</p>
      {open && <MossSheet onClose={() => setOpen(false)} actions={actions} settingsTo={settingsTo} />}
    </div>
  );
}

/**
 * The small round Moss in the bottom corner, within reach of a thumb and clear of the tabs and the
 * phone's own bars. Not shown where Moss already sits in the middle of the page.
 */
export function MossButton({ actions, settingsTo }: { actions: MossAction[]; settingsTo: string }) {
  const { settings } = useMoss();
  const [open, setOpen] = useState(false);
  if (!settings.show) return null;
  return (
    <>
      <button
        type="button"
        className="moss-fab"
        aria-label={`${settings.name}. What would help?`}
        onClick={() => setOpen(true)}
      >
        <Moss size={44} decorative />
      </button>
      {open && <MossSheet onClose={() => setOpen(false)} actions={actions} settingsTo={settingsTo} />}
    </>
  );
}
