import { useState } from 'react';
import { ScamWarning } from '../ScamWarning';
import { makeStep } from '../../lib/content/steps';
import { askAbout, explain, helperAvailable, toUnderstanding } from '../../lib/helper/client';
import { readFacts } from '../../lib/logic/facts';
import { nothingToDo } from '../../lib/logic/items';
import type { Item, Needs, StepType, Understanding } from '../../lib/model/types';
import { fmtDate } from '../../lib/papers/record';
import { useStore } from '../../lib/store/StoreProvider';
import { Thumb } from '../Capture';
import { Card, Choice, fromLocalInput, Text, toDateInput } from '../ui';
import { clock } from '../../lib/time';
import { FoundFact, OnTheLetter, Unsure } from '../OnTheLetter';
import { PlusNote } from '../PlusNote';
import { Words } from '../Words';
import { ReadAloud, say, useEasy } from '../voice';

type Level = 'easy' | 'plain' | 'full';
const LEVELS: { code: Level; text: string }[] = [
  { code: 'easy', text: 'Easy-read' },
  { code: 'plain', text: 'Plain' },
  { code: 'full', text: 'More detail' },
];

/** Easy-read shown one idea at a time: each sentence on its own card. */
export function ideas(text: string): string[] {
  return text
    .split(/(?<=[.?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const NEEDS: { code: Needs; text: string }[] = [
  { code: 'yes', text: 'Yes' },
  { code: 'no', text: 'No' },
  { code: 'unclear', text: 'Not sure' },
];

/**
 * The first screen: what it is, what they want, by when, and what happens if nothing is done.
 * Every fact shows the words it came from. The helper can fill it in; it works without it too.
 */
export function Understand({ item, onNext, onDone }: { item: Item; onNext: () => void; onDone: () => void }) {
  const { saveItem, data, user, plus, offerUndo } = useStore();
  const settings = data.settings;
  const easy = useEasy();
  const facts = readFacts(item.text, new Date(item.createdAt));
  const u = item.understanding;
  const [needs, setNeeds] = useState<Needs | undefined>(u?.needs);
  const [ask, setAsk] = useState(u?.ask ?? '');
  const [due, setDue] = useState(u?.dueAt ?? item.dueAt ?? facts.deadline?.value);
  const [consequence, setConsequence] = useState(u?.consequence ?? '');
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [showWords, setShowWords] = useState(!u);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [level, setLevel] = useState<Level>(easy ? 'easy' : 'plain');
  const canHelp = settings.helperOn && helperAvailable() && Boolean(user) && plus && item.text.trim().length > 20;

  const keep = async (next: Partial<Understanding>, extra: Partial<Item> = {}) => {
    const value: Understanding = {
      plain: u?.plain ?? '',
      easy: u?.easy ?? '',
      quotes: u?.quotes ?? [],
      by: u?.by ?? 'me',
      needs: needs ?? 'unclear',
      ask,
      consequence,
      ...(due !== undefined ? { dueAt: due } : {}),
      ...next,
    };
    await saveItem({ ...item, understanding: value, updatedAt: clock(), ...extra });
  };

  const runHelper = async () => {
    setBusy('Reading it…');
    setNote('');
    const r = await explain(item);
    setBusy('');
    if (!r.ok) {
      setNote(r.text);
      return;
    }
    const value = toUnderstanding(r.value);
    setNeeds(value.needs);
    setAsk(value.ask);
    setConsequence(value.consequence);
    if (value.dueAt !== undefined) setDue(value.dueAt);
    const suggested = r.value.steps.length
      ? r.value.steps.map((s) => ({ ...makeStep({ type: s.type as StepType, title: s.title, help: '', easyHelp: '' }) }))
      : undefined;
    // Keep the help text from the usual steps where the type matches.
    const steps = suggested?.map((s) => {
      const usual = item.steps.find((x) => x.type === s.type);
      return usual ? { ...s, help: usual.help, easyHelp: usual.easyHelp } : { ...s, help: 'Do this one part. You can stop and come back.', easyHelp: 'Do this part.' };
    });
    await saveItem({
      ...item,
      understanding: value,
      from: item.from || r.value.from,
      reference: item.reference || r.value.reference,
      ...(steps && !item.steps.some((s) => s.done) ? { steps, at: 0 } : {}),
      updatedAt: clock(),
    });
    setShowWords(false);
  };

  const next = async () => {
    await keep({}, { status: item.status === 'new' ? 'working' : item.status });
    onNext();
  };

  const nothing = async () => {
    offerUndo('Filed as nothing to do', item);
    await saveItem(nothingToDo({ ...item, understanding: { plain: u?.plain ?? '', easy: u?.easy ?? '', quotes: u?.quotes ?? [], by: u?.by ?? 'me', needs: 'no', ask: '', consequence: '' } }));
    onDone();
  };

  const runAsk = async () => {
    setAnswer('…');
    const r = await askAbout(item, question, settings);
    setAnswer(r.ok ? r.value : r.text);
  };

  const spoken = [
    u ? say(easy, u.plain, u.easy) : '',
    ask ? `They want you to ${ask.replace(/^to /i, '')}` : '',
    due ? `By ${fmtDate(due)}.` : '',
    consequence ? `If nothing is done: ${consequence}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-4">
      <ReadAloud text={spoken || say(easy, 'First, what does it say? Answer the questions below.', 'What does it say?')} />

      {facts.scam.length ? <ScamWarning reasons={facts.scam} /> : null}

      {u?.plain ? (
        <Card className="flex flex-col gap-2">
          <h2 className="font-semibold">What it is</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="How much to show">
            {LEVELS.filter((l) => l.code !== 'full' || u.full).map((l) => (
              <button key={l.code} type="button" className="chip" aria-pressed={level === l.code} onClick={() => setLevel(l.code)}>
                {l.text}
              </button>
            ))}
          </div>
          {level === 'easy' ? (
            <ol className="flex flex-col gap-2">
              {ideas(u.easy || u.plain).map((idea, i) => (
                <li key={i} className="rounded-lg border border-[var(--line)] p-3 text-lg">
                  {idea}
                </li>
              ))}
            </ol>
          ) : (
            <Words text={level === 'full' && u.full ? u.full : u.plain} />
          )}
          {u.quotes.length ? (
            <div className="flex flex-col gap-1">
              <p className="muted text-sm">Found in the {item.kind === 'email' ? 'email' : 'letter'}:</p>
              {u.quotes.map((q) => (
                <div key={q} className="flex flex-col gap-1">
                  <blockquote className="quote">{q}</blockquote>
                  <OnTheLetter item={item} quote={q} />
                </div>
              ))}
              <p className="muted text-xs">Written by the helper from the words above. Check anything important on the letter.</p>
            </div>
          ) : null}
        </Card>
      ) : null}

      {canHelp && !u?.plain ? (
        <button type="button" className="btn btn-accent" disabled={Boolean(busy)} onClick={() => void runHelper()}>
          {busy || (easy ? 'Explain it to me' : 'Explain it')}
        </button>
      ) : null}
      {!u?.plain && item.text.trim().length > 20 ? <PlusNote text="With Dealt With Plus, the helper can explain it in plain words and answer questions about it." /> : null}
      {note ? <p className="warnbox">{note}</p> : null}

      <Card className="flex flex-col gap-4">
        <Choice label={easy ? 'Do you need to do something?' : 'Does it ask you to do anything?'} options={NEEDS} value={needs} onChange={setNeeds} />
        {needs === 'unclear' && u?.unclear ? <p className="text-sm">Not clear from the letter: {u.unclear}</p> : null}
        {needs === 'unclear' ? (
          <p className="muted text-sm">
            If it is not clear, ring them and ask, or ask someone you trust to look at it with you.{facts.phones[0] ? ` Their number is ${facts.phones[0].value}.` : ''} Asking is allowed and costs nothing.
          </p>
        ) : null}
        {needs !== 'no' ? (
          <>
            <Text label={easy ? 'What do they want?' : 'What do they want you to do?'} value={ask} onChange={setAsk} placeholder="Send a bank statement" />
            <label className="block">
              <span className="label">{easy ? 'By when?' : 'By when?'}</span>
              <input className="field" type="date" value={due !== undefined ? toDateInput(due) : ''} onChange={(e) => setDue(e.target.value ? fromLocalInput(`${e.target.value}T12:00`) : undefined)} />
            </label>
            {facts.deadline && facts.deadline.value !== due ? (
              <button type="button" className="chip self-start" onClick={() => setDue(facts.deadline?.value)}>
                Use {fmtDate(facts.deadline.value)}, found: “{facts.deadline.quote}”
              </button>
            ) : facts.deadline ? (
              <p className="muted text-sm">Found: “{facts.deadline.quote}”</p>
            ) : null}
            {facts.deadline ? <Unsure reason={facts.deadline.unsure} /> : null}
            {facts.deadline ? <OnTheLetter item={item} quote={facts.deadline.quote} /> : null}
            <Text label={easy ? 'What happens if you do nothing?' : 'What happens if nothing is done? (optional)'} value={consequence} onChange={setConsequence} />
          </>
        ) : null}
      </Card>

      {facts.amounts.length || facts.references.length || facts.phones.length ? (
        <Card className="flex flex-col gap-2">
          <h2 className="font-semibold">Found in it</h2>
          <div className="flex flex-col gap-2">
            {facts.amounts.slice(0, 3).map((a) => (
              <FoundFact key={`a${a.value}`} item={item} label="Amount" value={a.value} quote={a.quote} unsure={a.unsure} />
            ))}
            {facts.references.slice(0, 3).map((r) => (
              <FoundFact key={`r${r.value}`} item={item} label="Reference" value={r.value} quote={r.quote} unsure={r.unsure} />
            ))}
            {facts.phones.slice(0, 3).map((p) => (
              <FoundFact key={`p${p.value}`} item={item} label="Phone" value={p.value} quote={p.quote} unsure={p.unsure} href={`tel:${p.value.replace(/\s/g, '')}`} />
            ))}
          </div>
        </Card>
      ) : null}

      {item.text.trim() || item.pageIds.length ? (
        <Card className="flex flex-col gap-2">
          <button type="button" className="text-left font-semibold" aria-expanded={showWords} onClick={() => setShowWords(!showWords)}>
            {showWords ? '▾' : '▸'} The words
          </button>
          {showWords ? (
            <>
              {item.pageIds.length ? (
                <div className="flex flex-wrap gap-2">
                  {item.pageIds.map((id, i) => (
                    <Thumb key={id} id={id} label={`Page ${i + 1}`} />
                  ))}
                </div>
              ) : null}
              <p className="muted text-xs">Tap an underlined word to see what it means.</p>
              <Words text={item.text} className="text-sm" />
            </>
          ) : null}
        </Card>
      ) : null}

      {canHelp ? (
        <Card className="flex flex-col gap-2">
          <Text label="Ask a question about it" value={question} onChange={setQuestion} placeholder="What is a single person discount?" />
          <button type="button" className="btn self-start" disabled={!question.trim()} onClick={() => void runAsk()}>
            Ask
          </button>
          {answer ? <p className="whitespace-pre-wrap">{answer}</p> : null}
        </Card>
      ) : null}

      {needs === 'no' ? (
        <button type="button" className="btn btn-primary" onClick={() => void nothing()}>
          {easy ? 'Nothing to do. Put it away.' : 'Nothing to do: file it as dealt with'}
        </button>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => void next()}>
          {easy ? 'Next' : 'Next: the first step'}
        </button>
      )}
    </div>
  );
}
