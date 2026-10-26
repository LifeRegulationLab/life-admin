import { whereLine, type WhereWasI } from '../../lib/logic/aids';
import { Thumb } from '../Capture';
import { Card } from '../ui';
import { ReadAloud } from '../voice';

/** Where was I?: the last step done, the next one, and what goes with it, in one card. */
export function WhereWasICard({ where }: { where: WhereWasI }) {
  const line = whereLine(where);
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="font-semibold">Where was I?</h2>
      <ReadAloud text={`Where was I? ${line} ${where.note ? `You wrote: ${where.note}.` : ''} ${where.keep.join('. ')}`} auto={false} />
      <p>{line}</p>
      {where.note ? (
        <p>
          <span className="muted text-sm">You wrote: </span>
          {where.note}
        </p>
      ) : null}
      {where.keep.length ? (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
          {where.keep.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      ) : null}
      {where.photoId ? <Thumb id={where.photoId} label="The page or proof that goes with it" /> : null}
    </Card>
  );
}
