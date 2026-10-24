import { useEffect, useState } from 'react';
import { onPlaying, speak, stop } from '../lib/speech';
import { useSettings, useStore } from '../lib/store/StoreProvider';
import { Picture } from './Picture';

/** The read aloud button. With "Read every screen" on in Me, each screen reads itself when it opens. */
export function ReadAloud({ text, auto = true }: { text: string; auto?: boolean }) {
  const { data, plus } = useStore();
  const settings = data.settings;
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => onPlaying(setPlaying), []);
  useEffect(() => () => stop(), []);

  useEffect(() => {
    if (!auto || settings.readAloud !== 'every' || !text) return;
    let live = true;
    void speak(text, settings.deviceVoice, plus).then((r) => {
      if (live && r === 'unavailable') setNote(UNAVAILABLE);
    });
    return () => {
      live = false;
      stop();
    };
  }, [auto, text, settings.readAloud, settings.deviceVoice, plus]);

  if (settings.readAloud === 'off') return null;

  const press = async () => {
    setNote('');
    if (playing) {
      stop();
      return;
    }
    const r = await speak(text, settings.deviceVoice, plus);
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

const UNAVAILABLE = 'The recorded voice is part of Dealt With Plus and needs a signal. You can also switch on the phone’s own voice in Me.';

/** Plain or easy-read words, depending on the setting in Me. */
export function useEasy(): boolean {
  return useSettings().easyRead;
}

export function say(easy: boolean, plain: string, easyText: string): string {
  return easy ? easyText || plain : plain;
}
