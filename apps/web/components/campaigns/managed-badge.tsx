/**
 * « Géré par Bayele » mark (design §5.1, council R3). Bayele's own orange dot, not a "verified" tick.
 * Real text (never aria-hidden); not a pill — it lives in the brand line, so the one-pill rule holds.
 */
export function ManagedBadge({ label, tone = 'light', size = 'sm', className = '' }: { label: string; tone?: 'light' | 'dark'; size?: 'sm' | 'md'; className?: string }) {
  const toneCls = tone === 'dark' ? 'border-white/15 bg-white/10 text-white' : 'border-line bg-white text-ink';
  const sizeCls = size === 'md' ? 'px-2.5 py-1 text-[12px]' : 'px-2 py-0.5 text-[11px]';
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-bold ${toneCls} ${sizeCls} ${className}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
      {label}
    </span>
  );
}
