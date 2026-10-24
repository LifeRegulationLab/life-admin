import { Link } from 'react-router';
import { helperAvailable } from '../lib/helper/client';
import { useStore } from '../lib/store/StoreProvider';

/** Shown where the helper would be, for people without Dealt With Plus. Every step still works without it. */
export function PlusNote({ text }: { text: string }) {
  const { plus } = useStore();
  if (plus || !helperAvailable()) return null;
  return (
    <p className="muted text-sm">
      {text}{' '}
      <Link to="/me#plus" className="underline">
        See Plus
      </Link>
    </p>
  );
}
