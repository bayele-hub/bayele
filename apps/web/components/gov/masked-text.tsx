import { EyeOff } from 'lucide-react';
import { splitMasked } from '@/lib/gov/masked';

/**
 * §4.2: renders server-masked tokens (« [numéro masqué] »…) as inline marks. The token text is what
 * screen readers read; the icon is decorative. `onBrand` = inside my own blue bubble.
 */
export function MaskedText({ text, onBrand = false }: { text: string; onBrand?: boolean }) {
  return (
    <>
      {splitMasked(text).map((s, i) =>
        s.masked ? (
          <mark key={i} data-masked className={`inline-flex items-center gap-0.5 rounded px-1 font-semibold not-italic text-inherit ${onBrand ? 'bg-white/20' : 'bg-black/10'}`}>
            <EyeOff className="h-3 w-3 shrink-0" aria-hidden />
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}
