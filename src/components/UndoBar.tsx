import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from '../lib/store/StoreProvider';

/** After a step is done, moved or deleted: a short while to take it back. */
export function UndoBar() {
  const { undo, runUndo, clearUndo } = useStore();
  const navigate = useNavigate();
  useEffect(() => {
    if (!undo) return;
    const t = window.setTimeout(clearUndo, 12000);
    return () => window.clearTimeout(t);
  }, [undo, clearUndo]);
  if (!undo) return null;
  return (
    <div role="status" className="fixed inset-x-0 z-30 flex justify-center px-4" style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}>
      <div className="flex max-w-xl flex-1 items-center gap-3 rounded-xl bg-[var(--hero)] px-4 py-3 text-[var(--on-hero)] shadow-lg">
        <span className="flex-1">{undo.label}</span>
        <button type="button" className="btn btn-accent min-h-9" onClick={() => void runUndo().then((id) => id && navigate(`/item/${id}`))}>
          Undo
        </button>
        <button type="button" className="min-h-9 px-2 underline" aria-label="Close" onClick={clearUndo}>
          Close
        </button>
      </div>
    </div>
  );
}
