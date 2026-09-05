import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: [
    '@bayele/ui',
    '@bayele/database',
    '@bayele/auth',
    '@bayele/notifications',
    '@bayele/sokoclick-sdk',
  ],
  images: {
    // Avatars come from Supabase Storage; blur-hash placeholders per mobile-first spec.
    // images.unsplash.com serves the illustrative creator portraits in the landing hero
    // (swap for licensed brand photography when available — see (public)/page.tsx hero).
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  experimental: { optimizePackageImports: ['lucide-react'] },
};

export default config;
