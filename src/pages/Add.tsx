import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { Capture } from '../components/Capture';
import { Unsure } from '../components/OnTheLetter';
import { ScamWarning } from '../components/ScamWarning';
import { Picture } from '../components/Picture';
import { Card, Page, Text } from '../components/ui';
import { ReadAloud, say, useEasy } from '../components/voice';
import { KIND_INFO } from '../lib/content/kinds';
import { readFacts } from '../lib/logic/facts';
import { hasIncoming, incomingHash, readIncoming, sourceName, type Incoming } from '../lib/logic/incoming';
import { newItem } from '../lib/logic/items';
import { KINDS, type Kind, type PageLine } from '../lib/model/types';
import { useStore } from '../lib/store/StoreProvider';

/** Says where the words came from, so a filled-in screen is never a surprise. */
function FromApp({ incoming }: { incoming: Incoming }) {
  if (!hasIncoming(incoming)) return null;
  const name = sourceName(incoming);
  return (
    <Card>
      <p>{name ? `These words came from ${name}.` : 'These words came with the link.'} Change anything you want before you save.</p>
    </Card>
  );
}

/** First choose what kind of thing it is. A link may say the kind, or bring words to carry on. */
export function Add() {
  const easy = useEasy();
  const { search, hash } = useLocation();
  const incoming = readIncoming(search, hash);
  const carry = incomingHash(incoming);
  if (incoming.kind) return <Navigate to={`/add/${incoming.kind}${carry}`} replace />;
  return (
    <Page title={easy ? 'What is it?' : 'Add something'}>
      <ReadAloud text={easy ? 'What is it? Choose one.' : 'What kind of thing is it? Choose one.'} />
      <FromApp incoming={incoming} />
      <div className="grid grid-cols-2 gap-3">
        {KINDS.map((k) => (
          <Link key={k} to={`/add/${k}${carry}`} className="card flex min-h-24 flex-col items-start gap-2">
            <Picture name={KIND_INFO[k].picture} size={easy ? 40 : 30} />
            <span className="font-semibold">{easy ? KIND_INFO[k].easy : KIND_INFO[k].name}</span>
            {easy ? null : <span className="muted text-sm">{KIND_INFO[k].hint}</span>}
          </Link>
        ))}
      </div>
      <Link to="/pile" className="btn">
        <Picture name="pile" size={20} />
        Several at once: pile of post
      </Link>
    </Page>
  );
}

const WITH_WORDS: Kind[] = ['letter', 'email', 'form', 'bill'];

/** Then get the words in, and check who it is from. */
export function AddKind() {
  const { kind } = useParams();
  const { saveItem } = useStore();
  const navigate = useNavigate();
  const easy = useEasy();
  const { search, hash } = useLocation();
  const [incoming] = useState(() => readIncoming(search, hash));
  const [text, setText] = useState(incoming.text);
  const [pageIds, setPageIds] = useState<string[]>([]);
  const [lines, setLines] = useState<PageLine[]>([]);
  const [title, setTitle] = useState(incoming.title);
  const [from, setFrom] = useState('');
  const [reference, setReference] = useState('');
  const [touched, setTouched] = useState({ from: false, reference: false });

  if (!kind || !(KINDS as readonly string[]).includes(kind)) return <Navigate to="/add" replace />;
  const k = kind as Kind;
  const info = KIND_INFO[k];
  const facts = readFacts(text);
  const shownFrom = touched.from ? from : from || facts.from || '';
  const shownRef = touched.reference ? reference : reference || facts.references[0]?.value || '';
  const wordsFirst = WITH_WORDS.includes(k);

  const save = async () => {
    const item = newItem(k, {
      title: title.trim() || (shownFrom ? `${info.name} from ${shownFrom}` : info.name),
      from: shownFrom.trim(),
      reference: shownRef.trim(),
      text,
      pageIds,
      lines,
      ...(facts.deadline ? { dueAt: facts.deadline.value } : {}),
    });
    await saveItem(item);
    navigate(`/item/${item.id}`, { replace: true });
  };

  return (
    <Page title={easy ? info.easy : `Add a ${info.name.toLowerCase()}`} back="/add">
      <ReadAloud text={wordsFirst ? say(easy, 'Take a photo of each page, paste it, or type the important parts.', 'Take a photo. Or paste it. Or type it.') : say(easy, 'Say what it is and who it is with. Add a letter or email about it if there is one.', 'Say what it is. Say who it is with.')} />
      <FromApp incoming={incoming} />
      {!wordsFirst ? (
        <Card className="flex flex-col gap-3">
          <Text label={easy ? 'What is it?' : 'What is it about?'} value={title} onChange={setTitle} placeholder={k === 'appointment' ? 'Dentist check-up' : k === 'call' ? 'Ring the bank about the card' : ''} />
          <Text label={k === 'call' ? 'Who to ring' : 'Who it is with'} value={shownFrom} onChange={(v) => { setFrom(v); setTouched((t) => ({ ...t, from: true })); }} />
        </Card>
      ) : null}
      <Card>
        <Capture text={text} onText={setText} pageIds={pageIds} onPages={setPageIds} lines={lines} onLines={setLines} easy={easy} />
      </Card>
      {wordsFirst ? (
        <Card className="flex flex-col gap-3">
          <h2 className="font-semibold">{text.trim() ? 'Check these' : 'Or just give it a name'}</h2>
          <Text label="Who it is from" value={shownFrom} onChange={(v) => { setFrom(v); setTouched((t) => ({ ...t, from: true })); }} />
          <Text label="Their reference" value={shownRef} onChange={(v) => { setReference(v); setTouched((t) => ({ ...t, reference: true })); }} />
          {!touched.reference && !reference && facts.references[0]?.unsure ? <Unsure reason={facts.references[0].unsure} /> : null}
          <Text label="A short name for it (optional)" value={title} onChange={setTitle} placeholder={shownFrom ? `${info.name} from ${shownFrom}` : ''} />
        </Card>
      ) : null}
      {facts.scam.length ? <ScamWarning reasons={facts.scam} /> : null}
      <button type="button" className="btn btn-primary" disabled={!text.trim() && !title.trim() && !shownFrom.trim()} onClick={() => void save()}>
        {easy ? 'Next' : 'Save and start'}
      </button>
    </Page>
  );
}
