import { useState } from 'react';
import { GLOSSARY, markTerms } from '../lib/content/glossary';

/** Text where the hard words can be tapped to see what they mean. */
export function Words({ text, className = '' }: { text: string; className?: string }) {
  const [open, setOpen] = useState<string>();
  const parts = markTerms(text);
  return (
    <div className="flex flex-col gap-2">
      <p className={`whitespace-pre-wrap ${className}`}>
        {parts.map((p, i) =>
          p.term ? (
            <button key={i} type="button" className="term" aria-expanded={open === p.term} onClick={() => setOpen(open === p.term ? undefined : p.term)}>
              {p.text}
            </button>
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
      </p>
      {open && GLOSSARY[open] ? (
        <p className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 text-sm" role="note">
          <strong className="capitalize">{open}</strong>: {GLOSSARY[open]}
        </p>
      ) : null}
    </div>
  );
}
