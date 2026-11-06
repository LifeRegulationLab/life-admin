import { Link } from 'react-router';
import { FromMull } from '../components/aids/FromMull';
import { itemName, ItemRow } from '../components/ItemRow';
import { Picture } from '../components/Picture';
import { TabIcon } from '../components/TabIcon';
import { Card, Page } from '../components/ui';
import { ReadAloud, useEasy } from '../components/voice';
import { lastTouched, whereLine, whereWasI } from '../lib/logic/aids';
import { weeksInARow, weeksLine } from '../lib/logic/history';
import { currentStep, dueOf, lists, notToMiss, whenWords } from '../lib/logic/items';
import { benefitDates, benefitTaskId, showDate } from '../lib/logic/money';
import { fmtDate } from '../lib/papers/record';
import { useStore } from '../lib/store/StoreProvider';
import { useNow } from '../lib/time';

const SOON = 60 * 24 * 60 * 60 * 1000;

export function Today() {
  const { data, saveSettings } = useStore();
  const justNext = data.settings.justNext;
  const now = useNow(); const easy = useEasy(); const l = lists(data.items, now);
  const coming = data.renewals.filter(r => !r.itemId && r.dueAt - now < SOON).sort((a, b) => a.dueAt - b.dueAt);
  const first = l.next[0]; const step = first ? currentStep(first) : undefined;
  const dates = notToMiss(data.items, first ? [first.id] : [], now);
  const benefitActions = benefitDates(data.benefits).filter(d => !data.items.some(i => i.id === benefitTaskId(d.benefit, d.kind)));
  const back = lastTouched(data.items); const where = back ? whereWasI(back) : undefined;
  const streak = data.settings.streaks ? weeksLine(weeksInARow(data.items, now)) : undefined;
  const summary = [first ? `Your next action: ${itemName(first)}. ${step?.title ?? 'Open it to check what is needed'}. ${whenWords(dueOf(first), now)}.` : 'Nothing to deal with just now.', `${l.waiting.length} waiting for a reply.`, benefitActions.length ? `${benefitActions.length} benefit dates saved. ${benefitActions[0]?.label} for ${benefitActions[0]?.benefit.name} by ${showDate(benefitActions[0]?.date ?? '')}.` : ''].join(' ');
  return <Page title="Today">
    <p className="page-intro">{easy ? 'One thing at a time.' : 'A clear place to start. Your other admin stays here.'}</p>
    <div className="today-tools"><label className="capacity-control"><input type="checkbox" checked={justNext} onChange={e => void saveSettings({ ...data.settings, justNext: e.target.checked })} /><span>Low capacity<span>Show just the next action</span></span></label><ReadAloud text={summary} /></div>
    <section className="next-action" aria-labelledby="next-action-title"><div className="next-action-top"><span className="eyebrow">{first ? 'Your next action' : 'Start here'}</span><span className="icon-tile"><Picture name={first ? 'letter' : 'done'} size={26} /></span></div><h2 id="next-action-title">{first ? itemName(first) : 'A little less to hold in your head.'}</h2><p>{first ? first.status === 'waiting' ? `Check whether ${first.waiting?.forWhat || 'the reply'} has arrived.` : step?.title || 'Open it and check what is needed.' : 'Add a letter, bill or form. Keep its next step, reply and proof together.'}</p>{first && <span className="status-pill">{whenWords(dueOf(first), now)}{step?.minutes ? ` · About ${step.minutes} min` : ''}</span>}<Link to={first ? `/item/${first.id}` : '/add'} className="btn btn-primary">{first ? first.pausedNote || first.steps.some(s => s.done) ? 'Carry on from here' : 'Start this step' : 'Add something'} <span aria-hidden="true">→</span></Link></section>
    <div className="overview-links"><Link to="/all?show=open"><strong>{l.next.length + l.unsorted.length}</strong><span>To deal with</span></Link><Link to="/all?show=waiting"><strong>{l.waiting.length}</strong><span>Waiting for them</span></Link><Link to="/all?show=done"><strong>{l.done.length}</strong><span>Dealt with</span></Link></div>
    {dates.length > 0 && <section className="space-y-3"><h2 className="section-title">Dates to keep in view</h2><p className="muted text-sm">Close dates stay visible, including on a low-capacity day.</p>{dates.map(i => <ItemRow key={i.id} item={i} now={now} />)}</section>}
    {benefitActions.length > 0 && <section className="space-y-3"><h2 className="section-title">Benefits: next dates</h2>{benefitActions.slice(0, 2).map(d => <Link className="card tone-peach" key={`${d.benefit.id}-${d.kind}`} to={`/money/benefits/${d.benefit.id}`}><strong>{d.label}: {d.benefit.name}</strong><span className="block text-sm mt-1">{showDate(d.date)} · Open the next steps →</span></Link>)}{benefitActions.length > 2 && <Link className="text-link" to="/money">See all benefit dates →</Link>}</section>}
    <Link className="support-strip tone-lilac" to="/stuck"><span className="icon-tile"><TabIcon name="help" /></span><span><strong>Something getting in the way?</strong><span>Make it smaller, understand it or save your place.</span></span><span aria-hidden="true">→</span></Link>
    {!justNext && <><div className="section-heading"><h2 className="section-title">Your admin, organised</h2><Link className="text-link" to="/all">See all →</Link></div><div className="feature-grid compact-grid"><Link className="feature-card tone-mint" to="/money"><span className="icon-tile"><TabIcon name="money" /></span><h3>Money & benefits</h3><p>Payments, reporting periods and claim dates.</p></Link><Link className="feature-card tone-blue" to="/renewals"><span className="icon-tile"><TabIcon name="renewals" /></span><h3>Renewals</h3><p>Keep repeating dates in view.</p></Link><Link className="feature-card tone-peach" to="/pile"><span className="icon-tile"><Picture name="pile" size={24} /></span><h3>Pile of post</h3><p>{l.unsorted.length ? `${l.unsorted.length} waiting to be sorted. Start with one.` : 'Capture first. Sort one at a time.'}</p></Link><Link className="feature-card tone-lilac" to="/where"><span className="icon-tile"><TabIcon name="everything" /></span><h3>Where was I?</h3><p>Find your place after an interruption.</p></Link></div>
    {back && where && back.id !== first?.id && <Card className="space-y-2"><p className="eyebrow">You last worked on</p><strong>{itemName(back)}</strong><p className="muted text-sm">{whereLine(where)}</p><Link className="text-link" to={`/item/${back.id}`}>Pick this up again →</Link></Card>}
    {l.next.length > 1 && <details className="card disclosure"><summary>Other things to deal with <span>{l.next.length - 1}</span></summary><div className="form-section">{l.next.slice(1).filter(i => !dates.some(d => d.id === i.id)).slice(0, 3).map(i => <ItemRow key={i.id} item={i} now={now} />)}<Link className="text-link" to="/all?show=open">Open all tasks →</Link></div></details>}
    {l.waiting.length > 0 && <details className="card disclosure"><summary>Waiting for them <span>{l.waiting.length}</span></summary><div className="form-section"><p className="muted text-sm">These are separate from your next actions. They return when it is time to chase.</p>{l.waiting.slice(0, 3).map(i => <ItemRow key={i.id} item={i} now={now} />)}<Link className="text-link" to="/all?show=waiting">Open all waiting →</Link></div></details>}
    {coming.length > 0 && <details className="card disclosure"><summary>Coming up for renewal <span>{coming.length}</span></summary><div className="form-section">{coming.slice(0, 3).map(r => <Link className="payment-line" key={r.id} to={`/renewals/${r.id}`}><strong>{r.title}</strong><span>{fmtDate(r.dueAt)} →</span></Link>)}<Link className="text-link" to="/renewals">All renewals →</Link></div></details>}<FromMull />{streak && <p className="muted text-sm">{streak}</p>}</>}
    {justNext && <p className="muted text-sm">Your other tasks are kept in Records. Money & benefits is always in the bottom bar.</p>}
  </Page>;
}
