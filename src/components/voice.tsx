import { useEffect, useState } from 'react';
import { onPlaying, speak, stop } from '../lib/speech';
import { useSettings } from '../lib/store/StoreProvider';
import { Picture } from './Picture';

/** The read aloud button. With "Read every screen" on in Me, each screen reads itself when it opens. */
export function ReadAloud({ text, auto = true }: { text: string; auto?: boolean }) {
  const settings = useSettings();
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => onPlaying(setPlaying), []);
  useEffect(() => () => stop(), []);

  useEffect(() => {
    if (!auto || settings.readAloud !== 'every' || !text) return;
    let live = true;
    void speak(text, settings.deviceVoice).then((r) => {
      if (live && r === 'unavailable') setNote(UNAVAILABLE);
    });
    return () => {
      live = false;
      stop();
    };
  }, [auto, text, settings.readAloud, settings.deviceVoice]);

  if (settings.readAloud === 'off') return null;

  const press = async () => {
    setNote('');
    if (playing) {
      stop();
      return;
    }
    const r = await speak(text, settings.deviceVoice);
    if (r === 'unavailable') setNote(UNAVAILABLE);
  };

  return (
    <div className="flex flex-col gap-1">
      <button type="button" className="btn self-start" aria-pressed={playing} onClick={() => void press()}>
        <Picture name="speaker" size={20} />
        {playing ? 'Stop' : 'Read aloud'}
      </button>
      {note ? <p className="muted text-sm">{note}</p> : null}
    </div>
  );
}

const UNAVAILABLE = 'Read aloud needs a signal and an account. You can also switch on the phone’s own voice in Me.';

/** Plain or easy-read words, depending on the setting in Me. */
export function useEasy(): boolean {
  return useSettings().easyRead;
}

export function say(easy: boolean, plain: string, easyText: string): string {
  return easy ? easyText || plain : plain;
}
