import type { MetadataRoute } from 'next';

// Public marketplace is crawlable; authenticated app + auth + API surfaces are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/admin', '/onboarding', '/creator/', '/consultant/', '/business/', '/profile', '/auth', '/api'],
    },
    sitemap: 'https://bayele.com/sitemap.xml',
    host: 'https://bayele.com',
  };
}
