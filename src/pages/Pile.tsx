import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Thumb } from '../components/Capture';
import { Picture } from '../components/Picture';
import { Card, Choice, Empty, Page, Text } from '../components/ui';
import { ReadAloud, useEasy } from '../components/voice';
import { KIND_INFO } from '../lib/content/kinds';
import { stepsFor } from '../lib/content/steps';
import { readFacts } from '../lib/logic/facts';
import { lists, newItem, nothingToDo, whenWords } from '../lib/logic/items';
import { KINDS, type Item, type Kind } from '../lib/model/types';
import { readPicture } from '../lib/ocr';
import { savePhoto, shrink } from '../lib/store/photos';
import { useStore } from '../lib/store/StoreProvider';
import { clock, useNow } from '../lib/time';

/**
 * A pile of post. First, a quick photo of the front page of each one, with no questions. Then
 * sort them one at a time: what is it, and does it need anything. Nothing is lost if you stop.
 */
export function Pile() {
  const { data, saveItem } = useStore();
  const easy = useEasy();
  const now = useNow();
  const [reading, setReading] = useState('');
  const [name, setName] = useState('');
  const [skipped, setSkipped] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const unsorted = lists(data.items, now).unsorted;
  const current = unsorted.find((i) => !skipped.includes(i.id)) ?? unsorted[0];

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const all = Array.from(files);
    for (const [n, f] of all.entries()) {
      setReading(`Reading ${n + 1} of ${all.length}…`);
      const small = await shrink(f);
      const id = await savePhoto(small);
      let text = '';
      try {
        text = await readPicture(small);
      } catch {
        text = '';
      }
      const facts = readFacts(text);
      await saveItem(
        newItem('letter', {
          title: facts.from ? `Letter from ${facts.from}` : `Letter ${unsorted.length + n + 1}`,
          from: facts.from ?? '',
          reference: facts.references[0]?.value ?? '',
          text,
          pageIds: [id],
          unsorted: true,
          ...(facts.deadline ? { dueAt: facts.deadline.value } : {}),
        }),
      );
    }
    setReading('');
  };

  const addByName = async () => {
    if (!name.trim()) return;
    await saveItem(newItem('letter', { title: name.trim(), unsorted: true }));
    setName('');
  };

  return (
    <Page title="Pile of post" back="/">
      <ReadAloud text={easy ? 'Take a photo of the front of each letter. Then sort them one at a time.' : 'First take a photo of the front page of each one. Then sort them, one at a time.'} />
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">1. Photos of the front page of each one</h2>
        <button type="button" className="btn btn-primary min-h-14" onClick={() => fileRef.current?.click()} disabled={Boolean(reading)}>
          <Picture name="camera" />
          {reading || 'Take or choose photos'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="sr-only" aria-label="Photos of the post" onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} />
        <div className="flex gap-2">
          <div className="flex-1">
            <Text label="Or just write what it is" value={name} onChange={setName} placeholder="Water bill" />
          </div>
          <button type="button" className="btn self-end" disabled={!name.trim()} onClick={() => void addByName()}>
            Add
          </button>
        </div>
        <p className="muted text-sm">Pictures stay on this phone. More pages can be added to each one later.</p>
      </Card>

      <section className="flex flex-col gap-3" aria-labelledby="sort">
        <h2 id="sort" className="font-semibold">
          2. Sort them {unsorted.length ? `(${unsorted.length} to go)` : ''}
        </h2>
        {current ? <SortOne key={current.id} item={current} now={now} onSkip={() => setSkipped((s) => [...s, current.id])} /> : <Empty>Nothing to sort. <Link to="/">Back to Today</Link></Empty>}
      </section>
    </Page>
  );
}

const NEEDS = [
  { code: 'yes', text: 'Yes' },
  { code: 'no', text: 'No' },
  { code: 'unclear', text: 'Not sure' },
] as const;

function SortOne({ item, now, onSkip }: { item: Item; now: number; onSkip: () => void }) {
  const { saveItem } = useStore();
  const easy = useEasy();
  const [kind, setKind] = useState<Kind>(item.kind);
  const kinds = KINDS.map((k) => ({ code: k, text: easy ? KIND_INFO[k].easy : KIND_INFO[k].name }));

  const answer = async (needs: 'yes' | 'no' | 'unclear') => {
    const base: Item = { ...item, kind, steps: kind === item.kind ? item.steps : stepsFor(kind), updatedAt: clock() };
    const { unsorted: _u, ...sorted } = base;
    void _u;
    if (needs === 'no') {
      await saveItem(nothingToDo(sorted));
      return;
    }
    await saveItem(
      needs === 'unclear'
        ? { ...sorted, understanding: { plain: '', easy: '', needs: 'unclear', ask: '', consequence: '', quotes: [], by: 'me', ...(item.dueAt ? { dueAt: item.dueAt } : {}) } }
        : sorted,
    );
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex gap-3">
        {item.pageIds[0] ? <Thumb id={item.pageIds[0]} label="Front page" /> : null}
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{item.title}</p>
          {item.dueAt ? <p className="text-sm">{whenWords(item.dueAt, now)}</p> : null}
          {item.text ? <p className="muted line-clamp-4 text-sm">{item.text.slice(0, 240)}</p> : null}
        </div>
      </div>
      <Choice label="What is it?" options={kinds} value={kind} onChange={setKind} />
      <fieldset>
        <legend className="label">{easy ? 'Do you need to do something?' : 'Does it need anything from you?'}</legend>
        <div className="grid grid-cols-3 gap-2">
          {NEEDS.map((n) => (
            <button key={n.code} type="button" className="btn" onClick={() => void answer(n.code)}>
              {n.text}
            </button>
          ))}
        </div>
      </fieldset>
      <p className="muted text-sm">Yes and Not sure go on your list. No is kept as dealt with.</p>
      <button type="button" className="btn self-start" onClick={onSkip}>
        Skip this one for now
      </button>
    </Card>
  );
}
