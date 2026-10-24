/**
 * Speaking instead of typing, using the phone or browser's own speech recognition where it has one.
 * Where it has none, the microphone button is not shown; the phone keyboard's own microphone still works.
 */

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type RecognitionClass = new () => Recognition;

function engine(): RecognitionClass | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function canDictate(): boolean {
  return typeof window !== 'undefined' && Boolean(engine());
}

/** Listens until the person stops talking, then hands back the words. Returns a stop function. */
export function dictate(onText: (text: string) => void, onEnd: () => void): () => void {
  const E = engine();
  if (!E) {
    onEnd();
    return () => undefined;
  }
  const r = new E();
  r.lang = 'en-GB';
  r.interimResults = false;
  r.continuous = false;
  r.onresult = (e) => {
    const text = Array.from(e.results)
      .map((x) => x[0]?.transcript ?? '')
      .join(' ')
      .trim();
    if (text) onText(text);
  };
  r.onend = onEnd;
  r.onerror = onEnd;
  r.start();
  return () => r.stop();
}
