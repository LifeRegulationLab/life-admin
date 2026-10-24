import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** Small shared pieces. Everything is plain HTML with labels, so screen readers and large text work. */

export function Page({ title, back, children, actions }: { title: string; back?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-32">
      {back ? (
        <Link to={back} className="muted mb-2 inline-block text-sm">
          ‹ Back
        </Link>
      ) : null}
      <div className="mb-4 flex items-start justify-between gap-3 pr-20">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {actions}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </main>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {hint ? <span className="muted mb-1 block text-sm">{hint}</span> : null}
      {children}
    </label>
  );
}

export function Text({
  label,
  hint,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label} {...(hint ? { hint } : {})}>
      <input
        className="field"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function Area({ label, hint, value, onChange, rows = 3 }: { label: string; hint?: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <Field label={label} {...(hint ? { hint } : {})}>
      <textarea className="field" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function Chips<T extends string>({
  options,
  selected,
  onToggle,
  label,
}: {
  options: readonly { code: T; text: string }[];
  selected: readonly string[];
  onToggle: (code: T) => void;
  label: string;
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.code} type="button" className="chip" aria-pressed={selected.includes(o.code)} onClick={() => onToggle(o.code)}>
            {o.text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Choice<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { code: T; text: string }[];
  value: T | undefined;
  onChange: (code: T) => void;
  label: string;
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.code} type="button" className="chip" aria-pressed={value === o.code} onClick={() => onChange(o.code)}>
            {o.text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted rounded-xl border border-dashed border-[var(--line-strong)] p-4 text-sm">{children}</p>;
}

export function toggle<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/** "YYYY-MM-DDTHH:MM" in local time, for datetime-local inputs. */
export function toLocalInput(at: number): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(v: string): number {
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? Date.now() : t;
}

export function toDateInput(at: number): string {
  return toLocalInput(at).slice(0, 10);
}
