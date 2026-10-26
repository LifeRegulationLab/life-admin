import { useState } from 'react';
import { Link } from 'react-router';
import { STUCK, STUCK_INFO, talkLink, type Stuck } from '../../lib/logic/aids';
import { currentStep, stepBefore } from '../../lib/logic/items';
import type { Item } from '../../lib/model/types';
import { useStore } from '../../lib/store/StoreProvider';
import { Card } from '../ui';
import { ReadAloud, useEasy } from '../voice';

export type StuckGoTo = 'understand' | 'step' | 'pause';

/**
 * What is stopping me?: five plain answers, and help that fits the answer. A missing document gets a
 * different answer from a thing that feels too big. Nothing has to be typed to get help.
 */
export function StuckPanel({ item, onGo }: { item?: Item; onGo?: (to: StuckGoTo) => void }) {
  const { data, saveItem, saveSettings, offerUndo } = useStore();
  const easy = useEasy();
  const [answer, setAnswer] = useState<Stuck>();
  const [text, setText] = useState('');
  const step = item ? currentStep(item) : undefined;

  const addStep = async (title: string, type: 'custom' | 'find') => {
    if (!item || !title.trim()) return;
    await saveItem(stepBefore(item, title, type));
    offerUndo('Step added', item);
    setText('');
    onGo?.('step');
  };

  const justNext = () => void saveSettings({ ...data.settings, justNext: true });

  const talk = (a: Stuck) => (
    <a href={talkLink(a)} target="_blank" rel="noopener" className="btn">
      Talk it through in Mull
    </a>
  );

  return (
    <div className="flex flex-col gap-4">
      <ReadAloud text={`What is stopping you? ${STUCK.map((s) => (easy ? STUCK_INFO[s].easy : STUCK_INFO[s].label)).join('. ')}.`} />
      <Card className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">What is stopping you?</h2>
        {item && step ? <p className="muted text-sm">For: {step.title}</p> : null}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STUCK.map((s) => (
            <button key={s} type="button" className="btn min-h-14 justify-start text-left" aria-pressed={answer === s} onClick={() => setAnswer(s)}>
              {easy ? STUCK_INFO[s].easy : STUCK_INFO[s].label}
            </button>
          ))}
        </div>
      </Card>

      {answer ? (
        <Card className="flex flex-col gap-3">
          <ReadAloud text={STUCK_INFO[answer].line} />
          <p className="text-lg">{STUCK_INFO[answer].line}</p>

          {answer === 'unclear' ? (
            <div className="flex flex-col gap-2">
              {item && onGo ? (
                <button type="button" className="btn btn-primary" onClick={() => onGo('understand')}>
                  Show what it says, in plain words
                </button>
              ) : null}
              <Link to="/help" className="btn">
                Free advice: Citizens Advice and others
              </Link>
              {talk(answer)}
            </div>
          ) : null}

          {answer === 'big' ? (
            <div className="flex flex-col gap-2">
              {item ? (
                <>
                  <label className="block">
                    <span className="label">The smallest first part you could do</span>
                    <input className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Find the letter" />
                  </label>
                  <button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={() => void addStep(text, 'custom')}>
                    Make that the next step
                  </button>
                </>
              ) : null}
              {!data.settings.justNext ? (
                <button type="button" className="btn" onClick={justNext}>
                  Show me just the next thing on Today
                </button>
              ) : null}
              {talk(answer)}
            </div>
          ) : null}

          {answer === 'worried' ? (
            <div className="flex flex-col gap-2">
              {item && onGo ? (
                <button type="button" className="btn btn-primary" onClick={() => onGo('step')}>
                  Ask someone to help with this step
                </button>
              ) : null}
              <Link to="/help" className="btn">
                Free advice first
              </Link>
              {talk(answer)}
              {item && onGo ? <p className="muted text-sm">Asking for help is at the bottom of the step.</p> : null}
            </div>
          ) : null}

          {answer === 'energy' ? (
            <div className="flex flex-col gap-2">
              {item && onGo ? (
                <button type="button" className="btn btn-primary" onClick={() => onGo('pause')}>
                  Stop here and keep my place
                </button>
              ) : null}
              {!data.settings.justNext ? (
                <button type="button" className="btn" onClick={justNext}>
                  Show me just the next thing on Today
                </button>
              ) : null}
              <Link to="/" className="btn">
                Back to Today
              </Link>
            </div>
          ) : null}

          {answer === 'missing' ? (
            <div className="flex flex-col gap-2">
              {item ? (
                <>
                  <label className="block">
                    <span className="label">What is missing?</span>
                    <input className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="My National Insurance number" />
                  </label>
                  <button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={() => void addStep(`Find ${text.trim().replace(/^find\s+/i, '')}`, 'find')}>
                    Make finding it the next step
                  </button>
                  {onGo ? (
                    <button type="button" className="btn" onClick={() => onGo('step')}>
                      Ask someone to find it for me
                    </button>
                  ) : null}
                </>
              ) : (
                <Link to="/add" className="btn">
                  Add it as something to deal with
                </Link>
              )}
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
