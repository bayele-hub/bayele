import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import './globals.css';
import { getDictionary, getLocale } from '@/i18n/dictionaries';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

// Per-locale SEO metadata (fixes i18n audit F4).
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    title: { default: t.meta.title, template: '%s — Bayele' },
    description: t.meta.description,
    metadataBase: new URL('https://bayele.app'),
    icons: { icon: '/logo.jpeg' },
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
