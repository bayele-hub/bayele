'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/error-state';

// Catches render/data errors anywhere in the signed-in workspaces (admin/creator/consultant/business/
// profile). Home escape hatch is the dashboard dispatcher, not the marketing site.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app] route error', error);
  }, [error]);
  return <ErrorState reset={reset} home="/dashboard" />;
}
