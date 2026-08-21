'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/error-state';

// Catches render/data errors anywhere in the signed-in workspaces (admin/creator/consultant/business/
// profile). Home escape hatch is the dashboard dispatcher, not the marketing site.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app] route error', error);
  }, [error]);
  return (
    <>
      <ErrorState reset={reset} home="/dashboard" />
      {/* TEMPORARY diagnostic — remove once the production crash is resolved. */}
      {(error?.message || error?.digest) && (
        <pre className="mx-auto mt-4 max-w-md overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-white p-3 text-left text-[11px] leading-relaxed text-rose-700">
          {error.digest ? `digest: ${error.digest}\n` : ''}
          {error.message || '(no message)'}
          {error.stack ? `\n\n${error.stack.split('\n').slice(0, 6).join('\n')}` : ''}
        </pre>
      )}
    </>
  );
}
