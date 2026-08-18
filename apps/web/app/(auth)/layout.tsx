import type { Metadata } from 'next';

// Auth + onboarding screens are transactional, not content — keep them out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
