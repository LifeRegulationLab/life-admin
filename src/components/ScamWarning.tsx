/** Shown when a letter or message has signs of a scam. A warning, never a verdict. */
export function ScamWarning({ reasons }: { reasons: string[] }) {
  return (
    <div className="warnbox flex flex-col gap-1" role="note">
      <p className="font-semibold">This might be a scam</p>
      {reasons.map((r) => (
        <p key={r}>{r}</p>
      ))}
      <p>Do not reply, pay or ring a number in it. Check by contacting the organisation using a number you already know. Citizens Advice scams helpline: 0808 250 5050.</p>
    </div>
  );
}
