import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, FileText, Shield, Lock } from 'lucide-react';

export const metadata = {
  title: 'Conditions Générales & Séquestre',
  description:
    "Conditions Générales d'Utilisation, Protocole de Séquestre Mobile Money et Politique de Confidentialité OHADA.",
};

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-white pb-20">
      <header className="sticky top-0 z-30 border-b border-line bg-white/85 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 text-xs font-bold text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Accueil
          </Link>
          <span className="flex items-center gap-1.5 text-xs font-bold text-brand">
            <Image src="/logo.jpeg" alt="" width={16} height={16} className="h-4 w-4 rounded object-contain" /> Centre Juridique &amp; Conformité
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 pt-8">
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Accords Juridiques &amp; Cadre de Séquestre</h1>
        <p className="mt-2 text-xs text-muted sm:text-sm">Dernière mise à jour : 16 août 2026 • Conforme droit OHADA et réglementations CEMAC / UEMOA.</p>
        <div className="mt-6 flex flex-wrap gap-2 border-b border-line pb-4 text-xs">
          <a href="#cgu" className="rounded-lg border border-line bg-white px-3 py-1.5 font-semibold text-ink hover:border-brand hover:text-brand">1. CGU</a>
          <a href="#escrow" className="rounded-lg border border-line bg-white px-3 py-1.5 font-semibold text-ink hover:border-brand hover:text-brand">2. Séquestre MoMo</a>
          <a href="#privacy" className="rounded-lg border border-line bg-white px-3 py-1.5 font-semibold text-ink hover:border-brand hover:text-brand">3. Données</a>
          <a href="#ohada" className="rounded-lg border border-line bg-white px-3 py-1.5 font-semibold text-ink hover:border-brand hover:text-brand">4. Facturation OHADA</a>
        </div>
        <section id="cgu" className="mt-8 space-y-3 text-sm leading-relaxed text-ink/80">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink"><FileText className="h-4 w-4 text-brand" /> 1. Conditions Générales d'Utilisation</h2>
          <p>Bayele opère comme infrastructure de mise en relation et de sécurisation financière entre Annonceurs, Consultants et Créateurs. Contenu complet à finaliser avec conseil juridique.</p>
        </section>
        <section id="escrow" className="mt-10 space-y-3 border-t border-line pt-8 text-sm leading-relaxed text-ink/80">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink"><Shield className="h-4 w-4 text-brand" /> 2. Protocole de Séquestre (Escrow)</h2>
          <p>Les fonds restent sous statut <code className="rounded bg-surface px-1">held</code> jusqu'à validation humaine de la preuve de diffusion, puis passent à <code className="rounded bg-surface px-1">releasable</code> et déclenchent le versement Mobile Money.</p>
        </section>
        <section id="privacy" className="mt-10 space-y-3 border-t border-line pt-8 text-sm leading-relaxed text-ink/80">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink"><Lock className="h-4 w-4 text-brand" /> 3. Données Personnelles</h2>
          <p>Les identifiants fiscaux et adresses de facturation des entreprises ne sont jamais publics. Seuls pseudonyme, ville, catégories et audience publique des créateurs apparaissent au directoire.</p>
        </section>
        <section id="ohada" className="mt-10 space-y-3 border-t border-line pt-8 text-sm leading-relaxed text-ink/80">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink"><FileText className="h-4 w-4 text-brand" /> 4. Facturation OHADA (SokoClick)</h2>
          <p>Factures certifiées conformes à l'Acte Uniforme OHADA, avec identifiant vérifiable pour la déductibilité fiscale.</p>
        </section>
      </main>
    </div>
  );
}
