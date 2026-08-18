'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/error-state';

// Catches errors in the auth + onboarding flow.
export default function AuthError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[auth] route error', error);
  }, [error]);
  return (
    <ErrorState
      reset={reset}
      home="/auth"
      title="Problème de connexion"
      message="Impossible de charger cette étape. Réessayez ou revenez à la page de connexion."
    />
  );
}
