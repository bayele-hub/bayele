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
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
  experimental: { optimizePackageImports: ['lucide-react'] },
};

export default config;
