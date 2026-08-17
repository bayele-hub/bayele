import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import './globals.css';
import { getDictionary, getLocale } from '@/i18n/dictionaries';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

// Per-locale SEO metadata (fixes i18n audit F4). Canonical domain is bayele.com (matches the
// Supabase auth site_url + Terraform production_url). OG/Twitter cards make WhatsApp + social
// shares render a rich preview (growth invariant: SEO + WhatsApp share).
export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getDictionary();
  return {
    title: { default: t.meta.title, template: '%s — Bayele' },
    description: t.meta.description,
    metadataBase: new URL('https://bayele.com'),
    icons: { icon: '/logo.jpeg' },
    alternates: { canonical: '/' },
    // Images come from the generated app/opengraph-image.tsx (file convention) — Next wires it to
    // both OpenGraph and Twitter automatically, so we don't set images here.
    openGraph: {
      type: 'website',
      siteName: 'Bayele',
      title: t.meta.title,
      description: t.meta.description,
      url: 'https://bayele.com',
      locale: locale === 'en' ? 'en_US' : 'fr_FR',
    },
    twitter: {
      card: 'summary_large_image',
      title: t.meta.title,
      description: t.meta.description,
    },
  };
}

export const viewport: Viewport = { themeColor: '#1268B8', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale(); // drives <html lang> (fixes audit F3)
  return (
    <html lang={locale} className={`${display.variable} ${sans.variable}`}>
      <body className="bg-white text-ink antialiased">{children}</body>
    </html>
  );
}
