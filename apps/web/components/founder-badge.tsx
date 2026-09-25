import { Award } from 'lucide-react';

/**
 * "Créateur fondateur" badge — awarded free to the first 10 000 creators (migration 0026).
 * Deliberately distinct from the blue "verified" pill: warm gold, a medal icon and the number,
 * which is the part people screenshot and share. Pure presentational; copy is passed in so it
 * works on i18n public pages and French-only app pages alike.
 */
export function FounderBadge({
  label,
  number,
  title,
  size = 'sm',
}: {
  label: string;
  /** Pre-formatted number, e.g. "n° 42". Omit to show the label only. */
  number?: string;
  /** Tooltip / accessible description, e.g. "Parmi les 10 000 premiers créateurs de Bayele". */
  title?: string;
  size?: 'sm' | 'md';
}) {
  const md = size === 'md';
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-r from-[#FDE7B0] to-[#F9D27A] font-bold text-[#6B4300] ring-1 ring-[#E9B949]/60 ${
        md ? 'px-2.5 py-1 text-[12px]' : 'px-2 py-0.5 text-[11px]'
      }`}
    >
      <Award className={md ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden />
      {label}
      {number && <span className="tabular-nums opacity-80">· {number}</span>}
      {title && <span className="sr-only">. {title}</span>}
    </span>
  );
}
