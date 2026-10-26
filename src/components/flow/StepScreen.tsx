import { useState } from 'react';
import { Moss } from '../Moss';
import { STEP_PICTURE, callScript, replyDraft } from '../../lib/content/steps';
import { callScriptFor, draftReply, helperAvailable } from '../../lib/helper/client';
import { toIcs } from '../../lib/logic/calendar';
import { readFacts } from '../../lib/logic/facts';
import { addRecord, completeStep, DAY, startWaiting, updateStep } from '../../lib/logic/items';
import type { Item, Step } from '../../lib/model/types';
import { fmtDate } from '../../lib/papers/record';
import { saveFile, shareText } from '../../lib/shell';
import { savePhoto, shrink } from '../../lib/store/photos';
import { useStore } from '../../lib/store/StoreProvider';
import { Thumb } from '../Capture';
import { itemName } from '../ItemRow';
import { Picture } from '../Picture';
import { Area, Card, Choice, fromLocalInput, Text, toDateInput, toLocalInput } from '../ui';
import { ReadAloud, say, useEasy } from '../voice';
import { PlusNote } from '../PlusNote';
import { ShareStep } from './ShareStep';
import { GetReady } from '../aids/GetReady';
import { SendToPace } from '../aids/SendToPace';
import { getReady, totalMinutes } from '../../lib/logic/aids';


const HOW: { code: NonNullable<Step['how']>; text: string }[] = [
  { code: 'online', text: 'Online' },
  { code: 'email', text: 'Email' },
  { code: 'post', text: 'Post' },
  { code: 'phone', text: 'Phone' },
  { code: 'in person', text: 'In person' },
];

/** One step on one screen, with help for doing it and a place for what was done. */
export function StepScreen({ item, step, index, onDone }: { item: Item; step: Step; index: number; onDone: (next: Item) => void }) {
  const { saveItem, data, user, plus, offerUndo } = useStore();
  const settings = data.settings;
  const easy = useEasy();
  const facts = readFacts(item.text, new Date(item.createdAt));
  const [note, setNote] = useState(step.note);
  const [draft, setDraft] = useState(step.draft ?? '');
  const [how, setHow] = useState(step.how);
  const [amount, setAmount] = useState(step.amount ?? facts.amounts[0]?.value ?? '');
  const [when, setWhen] = useState(step.at);
  const [ref, setRef] = useState('');
  const [proofIds, setProofIds] = useState<string[]>([]);
  const [waitFor, setWaitFor] = useState(step.note || 'their reply');
  const [chase, setChase] = useState(() => Date.now() + 14 * DAY);
  const [helperNote, setHelperNote] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const canHelp = settings.helperOn && helperAvailable() && Boolean(user) && plus;
  const ask = item.understanding?.ask ?? '';
  const ready = getReady(item, step);
  const total = totalMinutes(item, step);

  const withFields = (base: Item): Item =>
    updateStep(base, step.id, {
      note,
      ...(draft ? { draft } : {}),
      ...(how ? { how } : {}),
      ...(amount && step.type === 'pay' ? { amount } : {}),
      ...(when !== undefined ? { at: when } : {}),
    });

  const keepDraft = () => void saveItem(withFields(item));

  const finish = async () => {
    let next = withFields(item);
    for (const id of proofIds) next = addRecord(next, 'proof', note || step.title, { photoId: id, ...(ref ? { ref } : {}) });
    if (ref && !proofIds.length) next = addRecord(next, step.type === 'pay' ? 'paid' : 'proof', `Reference: ${ref}`, { ref });
    next = completeStep(next, step.id);
    await saveItem(next);
    offerUndo(`Done: ${step.title}`, item);
    onDone(next);
  };

  const wait = async () => {
    let next = withFields(item);
    next = startWaiting(next, waitFor, chase);
    await saveItem(next);
    offerUndo('Moved to Waiting for them', item);
    onDone(next);
  };

  const helperDraft = async () => {
    setBusy('Writing…');
    const r = step.type === 'call' ? await callScriptFor(item, helperNote, settings) : await draftReply(item, helperNote, settings);
    setBusy('');
    if (r.ok) setDraft(r.value);
    else setMsg(r.text);
  };

  const plainDraft = () =>
    setDraft(
      step.type === 'call'
        ? callScript({ name: settings.name, reference: item.reference, from: item.from, ask })
        : replyDraft({ name: settings.name, address: settings.address, reference: item.reference, from: item.from, ask, today: new Date() }),
    );

  const copy = async () => {
    const r = await shareText(itemName(item), draft);
    setMsg(r === 'copied' ? 'Copied. Paste it into the email or the website.' : r === 'failed' ? 'That did not work. Select the words and copy them.' : '');
  };

  const addToCalendar = async () => {
    if (when === undefined) return;
    const ics = toIcs([{ id: `${item.id}-${step.id}`, title: itemName(item), at: when, minutes: 60, notes: [item.from, item.reference && `Reference ${item.reference}`, note].filter(Boolean).join('\n'), alarm: 24 * 60 }]);
    await saveFile(`${itemName(item).replace(/[^\w -]/g, '').slice(0, 40) || 'appointment'}.ics`, new TextEncoder().encode(ics), 'text/calendar');
  };

  const addProof = async (files: FileList | null) => {
    if (!files?.length) return;
    const ids: string[] = [];
    for (const f of Array.from(files)) ids.push(await savePhoto(await shrink(f)));
    setProofIds((p) => [...p, ...ids]);
  };

  const help = say(easy, step.help, step.easyHelp);
  const readyLines = [...ready.found, ...ready.own];
  const spoken = `${step.title}. ${help}${readyLines.length ? ` Get these ready first. ${readyLines.join('. ')}.` : ''}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        {settings.pictures || easy ? <Picture name={STEP_PICTURE[step.type]} size={easy ? 56 : 36} /> : null}
        <div className="flex flex-col gap-1">
          <p className="muted text-sm">
            Step {index + 1} of {item.steps.length}
            {total ? ` · about ${total} minutes${ready.minutes && step.minutes ? ', with getting ready' : ''}` : ''}
          </p>
          <h2 className={`${easy ? 'text-2xl' : 'text-xl'} font-semibold`}>{step.title}</h2>
        </div>
      </div>
      <ReadAloud text={spoken} />
      {help ? (
        <Card>
          <p className={easy ? 'text-lg' : ''}>{help}</p>
        </Card>
      ) : null}
      {ask && index === 0 ? <p className="muted text-sm">They want you to: {ask}</p> : null}

      {step.type !== 'wait' ? <GetReady item={item} step={step} /> : null}

      {step.type === 'reply' || step.type === 'call' ? (
        <Card className="flex flex-col gap-3">
          {step.type === 'call' && facts.phones.length ? (
            <p>
              Their number:{' '}
              {facts.phones.slice(0, 2).map((p) => (
                <a key={p.value} className="mr-3 font-semibold" href={`tel:${p.value.replace(/\s/g, '')}`}>
                  {p.value}
                </a>
              ))}
            </p>
          ) : null}
          {canHelp ? (
            <>
              <Text label={step.type === 'call' ? 'What do you need from the call?' : 'What do you want to say? A few words is enough.'} value={helperNote} onChange={setHelperNote} />
              <div className="flex items-center gap-3">
                <Moss mood={busy ? 'thinking' : 'ready'} size={44} />
                <button type="button" className="btn btn-accent self-start" disabled={Boolean(busy)} onClick={() => void helperDraft()}>
                  {busy || (step.type === 'call' ? 'Write a script for me' : 'Draft it for me')}
                </button>
              </div>
            </>
          ) : (
            <PlusNote text={step.type === 'call' ? 'With Dealt With Plus, the helper can write a script for the call.' : 'With Dealt With Plus, the helper can draft the reply for you.'} />
          )}
          {!draft ? (
            <button type="button" className="btn self-start" onClick={plainDraft}>
              {step.type === 'call' ? 'Start from a simple script' : 'Start from a simple letter'}
            </button>
          ) : null}
          <Area label={step.type === 'call' ? 'What to say' : 'Your reply'} value={draft} onChange={setDraft} rows={10} />
          {draft ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn" onClick={() => void copy()}>
                {step.type === 'call' ? 'Share' : 'Copy or share'}
              </button>
              <button type="button" className="btn" onClick={keepDraft}>
                Keep it for later
              </button>
            </div>
          ) : null}
          {step.type === 'reply' ? <p className="muted text-sm">Read it through before you send it. Change anything that is not right.</p> : null}
        </Card>
      ) : null}

      {step.type === 'send' ? (
        <Card className="flex flex-col gap-3">
          <Choice label="How did you send it?" options={HOW} value={how} onChange={setHow} />
        </Card>
      ) : null}

      {step.type === 'pay' ? (
        <Card className="flex flex-col gap-3">
          <Text label="How much" value={amount} onChange={setAmount} />
          <Choice label="How did you pay?" options={HOW} value={how} onChange={setHow} />
        </Card>
      ) : null}

      {step.type === 'proof' || step.type === 'pay' || step.type === 'send' ? (
        <Card className="flex flex-col gap-3">
          <Text label="Confirmation or receipt number (if there is one)" value={ref} onChange={setRef} />
          <label className="btn self-start">
            <Picture name="camera" size={20} />
            Add a photo of the proof
            <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => void addProof(e.target.files)} />
          </label>
          {proofIds.length ? (
            <div className="flex flex-wrap gap-2">
              {proofIds.map((id, i) => (
                <Thumb key={id} id={id} label={`Proof ${i + 1}`} />
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      {step.type === 'book' || step.type === 'attend' ? (
        <Card className="flex flex-col gap-3">
          <label className="block">
            <span className="label">When</span>
            <input className="field" type="datetime-local" value={when !== undefined ? toLocalInput(when) : ''} onChange={(e) => setWhen(e.target.value ? fromLocalInput(e.target.value) : undefined)} />
          </label>
          {when !== undefined ? (
            <button type="button" className="btn self-start" onClick={() => void addToCalendar()}>
              <Picture name="calendar" size={20} />
              Add to my calendar
            </button>
          ) : null}
        </Card>
      ) : null}

      {step.type === 'wait' ? (
        <Card className="flex flex-col gap-3">
          <Text label="What are you waiting for?" value={waitFor} onChange={setWaitFor} />
          <label className="block">
            <span className="label">Chase them if nothing has come by</span>
            <input className="field" type="date" value={toDateInput(chase)} onChange={(e) => e.target.value && setChase(fromLocalInput(`${e.target.value}T09:00`))} />
          </label>
          <button type="button" className="btn btn-primary" onClick={() => void wait()}>
            {easy ? 'Now wait' : 'Move to Waiting for them'}
          </button>
          <p className="muted text-sm">It leaves your list until {fmtDate(chase)}, or until you say their reply came.</p>
        </Card>
      ) : (
        <>
          <Area label={step.type === 'call' ? 'Who you spoke to and what they said' : easy ? 'Notes (if you want)' : 'Notes for the record (optional)'} value={note} onChange={setNote} rows={3} />
          {msg ? <p className="muted">{msg}</p> : null}
          <button type="button" className="btn btn-primary min-h-14 text-lg" onClick={() => void finish()}>
            <Picture name="check" size={22} />
            {easy ? 'Done' : 'Done, next step'}
          </button>
        </>
      )}

      {step.type !== 'wait' ? <SendToPace item={item} step={step} /> : null}
      <ShareStep item={item} step={step} />
    </div>
  );
}
