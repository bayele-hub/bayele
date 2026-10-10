import { WhatsAppTile } from '@/components/campaigns/card-parts';
import { bayeleWhatsappHref } from '@/lib/whatsapp';

/**
 * « Publiez par WhatsApp » brand CTA (K5, design §6). Renders NOTHING when NEXT_PUBLIC_BAYELE_WHATSAPP
 * is unset or invalid — no placeholder, no disabled button. Hook-free, so it works in server and
 * client components. The caller passes the already-filled message (lib/whatsapp.publishMessage) and
 * decides the audience (never shown to signed-in creators or admins).
 *
 *   button — secondary button on white (or on ink/brand panels with tone="onDark")
 *   link   — small text link (auth page, /campaigns footer — council R6)
 *   band   — bordered band with title + body + button (top of the brand form)
 */
export function PublishWhatsAppCta({
  label,
  ariaSuffix,
  message,
  variant = 'button',
  tone = 'light',
  title,
  body,
  className = '',
  fullWidth = false,
}: {
  label: string;
  ariaSuffix: string;
  message: string;
  variant?: 'button' | 'link' | 'band';
  tone?: 'light' | 'onDark';
  title?: string;
  body?: string;
  className?: string;
  fullWidth?: boolean;
}) {
  const href = bayeleWhatsappHref(message);
  if (!href) return null;
  const aria = `${label} ${ariaSuffix}`;

  if (variant === 'link') {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={aria}
        className={`inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand ${className}`}>
        <WhatsAppTile className="h-5 w-5" /> {label}
      </a>
    );
  }

  const button = (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={aria}
      className={[
        'inline-flex min-h-tap items-center justify-center gap-2 rounded-xl border px-5 text-sm font-bold shadow-sm transition active:scale-95',
        tone === 'onDark' ? 'border-transparent bg-white text-ink hover:bg-white/90' : 'border-line bg-white text-ink hover:border-[#25D366]',
        fullWidth || variant === 'band' ? 'w-full sm:w-auto' : '',
        variant === 'button' ? className : '',
      ].join(' ')}>
      <WhatsAppTile /> {label}
    </a>
  );

  if (variant === 'band') {
    return (
      <div className={`rounded-2xl border border-line bg-white p-4 sm:flex sm:items-center sm:justify-between sm:gap-6 ${className}`}>
        <div>
          {title && <p className="text-[15px] font-bold text-ink">{title}</p>}
          {body && <p className="mt-0.5 text-[13px] text-muted">{body}</p>}
        </div>
        <div className="mt-3 shrink-0 sm:mt-0">{button}</div>
      </div>
    );
  }
  return button;
}
