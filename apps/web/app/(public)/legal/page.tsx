import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, FileText, Shield, Lock, Handshake } from 'lucide-react';
import { getDictionary } from '@/i18n/dictionaries';
import { CopyLink } from './copy-link';

export const metadata = {
  title: 'Conditions Générales & Séquestre',
  description:
    "Conditions Générales d'Utilisation, non-contournement, Protocole de Séquestre Mobile Money et Politique de Confidentialité OHADA.",
};

/**
 * /legal (G7, G10, P5, P6): CGU + §1.1 non-contournement, escrow, privacy §3.1–3.5, OHADA invoicing.
 * FR/EN from the dictionary (`legal.*`, the Legal seat's text with the decided values). The pending
 * local-counsel review is recorded in docs/, never on this page.
 */
export default async function LegalPage() {
  const { t } = await getDictionary();
  const L = t.legal;
  const toc: [string, string][] = [['cgu', L.toc[0]!], ['non-contournement', L.toc[1]!], ['escrow', L.toc[2]!], ['privacy', L.toc[3]!], ['ohada', L.toc[4]!]];
  const sub = (anchor: string, title: string, body: string | string[], lead?: string) => (
    <div id={anchor} className="scroll-mt-20 space-y-2">
      <h3 className="flex items-center gap-1 text-sm font-bold text-ink">
        <span className="min-w-0">{title}</span>
        <CopyLink anchor={anchor} label={L.copyLink} done={L.copied} />
      </h3>
      {(Array.isArray(body) ? body : [body]).map((p, i) => <p key={i}>{lead && i === 0 && <strong className="text-ink">{lead}. </strong>}{p}</p>)}
    </div>
  );
  const strip = (title: string) => title.replace(/^\d+(\.\d+)?\s+/, '');

  return (
    <div className="min-h-screen bg-white pb-20">
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-white/85 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2">
          <Link href="/" className="inline-flex min-h-tap items-center gap-1.5 text-xs font-bold text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> {L.home}
          </Link>
          <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-brand">
            <Image src="/logo.jpeg" alt="" width={16} height={16} className="h-4 w-4 shrink-0 rounded object-contain" /> <span className="truncate">{L.center}</span>
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 pt-8">
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">{L.title}</h1>
        <p className="mt-2 text-xs text-muted sm:text-sm">{L.updated} • {L.compliance}</p>
        <nav className="mt-6 flex flex-wrap gap-2 border-b border-line pb-4 text-xs">
          {toc.map(([a, label]) => (
            <a key={a} href={`#${a}`} className="inline-flex min-h-tap items-center rounded-lg border border-line bg-white px-3 font-semibold text-ink hover:border-brand hover:text-brand">{label}</a>
          ))}
        </nav>

        <section id="cgu" className="mt-8 scroll-mt-20 space-y-4 text-sm leading-relaxed text-ink/80">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink"><FileText className="h-4 w-4 text-brand" /> {L.cgu.title}</h2>
          <p>{L.cgu.body}</p>
          <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-brand-700"><Handshake className="h-4 w-4" aria-hidden /></div>
            {sub('non-contournement', L.nonCircumvention.title, L.nonCircumvention.body)}
          </div>
        </section>

        <section id="escrow" className="mt-10 scroll-mt-20 space-y-3 border-t border-line pt-8 text-sm leading-relaxed text-ink/80">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink"><Shield className="h-4 w-4 text-brand" /> {L.escrow.title}</h2>
          <p>{L.escrow.body}</p>
        </section>

        <section id="privacy" className="mt-10 scroll-mt-20 space-y-5 border-t border-line pt-8 text-sm leading-relaxed text-ink/80">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink"><Lock className="h-4 w-4 text-brand" /> {L.privacy.title}</h2>
          <p>{L.privacy.intro}</p>
          {sub('privacy-review', L.privacy.review.title, L.privacy.review.body, strip(L.privacy.review.title))}
          {sub('privacy-logs', L.privacy.logs.title, L.privacy.logs.body, strip(L.privacy.logs.title))}
          {sub('privacy-proofs', L.privacy.proofs.title, L.privacy.proofs.body, strip(L.privacy.proofs.title))}
          {sub('privacy-messages', L.privacy.messages.title, L.privacy.messages.body, strip(L.privacy.messages.title))}
          {sub('privacy-rights', L.privacy.rights.title, L.privacy.rights.body, strip(L.privacy.rights.title))}
        </section>

        <section id="ohada" className="mt-10 scroll-mt-20 space-y-3 border-t border-line pt-8 text-sm leading-relaxed text-ink/80">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink"><FileText className="h-4 w-4 text-brand" /> {L.ohada.title}</h2>
          <p>{L.ohada.body}</p>
        </section>
      </main>
    </div>
  );
}
