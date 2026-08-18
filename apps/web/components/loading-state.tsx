import { Loader2 } from 'lucide-react';

/**
 * Shared loading fallback for route-level loading.tsx (Suspense) boundaries. Mobile-first: a centered
 * brand spinner that holds layout while server components stream, instead of a blank frame.
 */
export function LoadingState({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <Loader2 className="h-7 w-7 animate-spin text-brand" />
      <p className="text-sm font-medium text-muted">{label}</p>
    </div>
  );
}
