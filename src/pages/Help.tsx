import { Card, Page } from '../components/ui';
import { ReadAloud } from '../components/voice';

/**
 * Free help, in one place. Numbers checked 24 October 2026; check them again every six months
 * (see docs/CHECKS.md).
 */
const PLACES = [
  { name: 'Citizens Advice', what: 'Free advice on letters, benefits, housing, work, debt and consumer problems.', phone: '0800 144 8848', note: 'Adviceline, England. Wales: 0800 702 2020.', web: 'https://www.citizensadvice.org.uk' },
  { name: 'Citizens Advice scams line', what: 'If you think a letter, email, call or text might be a scam.', phone: '0808 250 5050', web: 'https://www.citizensadvice.org.uk/consumer/scams/' },
  { name: 'StepChange', what: 'Free debt advice and help to set up a plan.', phone: '0800 138 1111', web: 'https://www.stepchange.org' },
  { name: 'National Debtline', what: 'Free, confidential debt advice by phone and online.', phone: '0808 808 4000', web: 'https://nationaldebtline.org' },
  { name: 'Samaritans', what: 'If things feel too much. Any time, day or night.', phone: '116 123', web: 'https://www.samaritans.org' },
];

export function Help() {
  return (
    <Page title="Help">
      <ReadAloud text="Free help. Citizens Advice, the scams line, StepChange, National Debtline and Samaritans. If anyone is in danger, call 999." />
      <p>Free, independent help. None of these will charge you. If anyone is in danger, call 999.</p>
      {PLACES.map((p) => (
        <Card key={p.name} className="flex flex-col gap-1">
          <h2 className="font-semibold">{p.name}</h2>
          <p>{p.what}</p>
          <p>
            <a className="text-lg font-semibold" href={`tel:${p.phone.replace(/\s/g, '')}`}>
              {p.phone}
            </a>
            {p.note ? <span className="muted text-sm"> {p.note}</span> : null}
          </p>
          <a className="text-sm" href={p.web} target="_blank" rel="noreferrer">
            {p.web.replace(/^https:\/\/(www\.)?/, '')}
          </a>
        </Card>
      ))}
      <Card className="flex flex-col gap-2">
        <h2 className="font-semibold">A few things that help</h2>
        <ul className="list-disc pl-5">
          <li>You can ring and ask what a letter means. That is allowed.</li>
          <li>If you cannot pay, ring them before the date. Most will agree a plan.</li>
          <li>Ask for the name of the person you speak to, and a reference for the call.</li>
          <li>Keep proof you sent things. Each step here keeps it for you.</li>
          <li>Real organisations never ask for your PIN, a password or payment by gift card.</li>
        </ul>
      </Card>
      <p className="muted text-sm">This app explains and organises. It is not legal or financial advice.</p>
    </Page>
  );
}
