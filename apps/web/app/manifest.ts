import type { MetadataRoute } from 'next';
import { SITE_DESC } from '@/lib/seo';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bayele — Influence marketing sous séquestre',
    short_name: 'Bayele',
    description: SITE_DESC,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1268B8',
    lang: 'fr',
    dir: 'ltr',
    categories: ['business', 'marketing', 'social'],
    icons: [{ src: '/logo.jpeg', sizes: 'any', type: 'image/jpeg', purpose: 'any' }],
  };
}
