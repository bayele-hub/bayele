'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/error-state';

// Catches errors in the public marketing + directory pages.
export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[public] route error', error);
  }, [error]);
  return <ErrorState reset={reset} home="/" />;
}
