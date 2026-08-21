'use client';

import { useActionState } from 'react';
import { Globe, EyeOff, Loader2 } from 'lucide-react';
import { setVisibilityAction, type VisibilityState } from './review-actions';

/**
 * Public/private switch for a campaign, on the brand's own detail page. Public campaigns get the
 * shareable page + SEO; private ones are visible only to signed-in creators in-app.
 */
export function VisibilityToggle({ campaignId, isPublic }: { campaignId: string; isPublic: boolean }) {
  const [state, action, pending] = useActionState<VisibilityState, FormData>(setVisibilityAction, { error: null });

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          {isPublic ? <Globe className="h-4 w-4 text-brand" /> : <EyeOff className="h-4 w-4 text-muted" />}
          <span className="font-bold text-ink">{isPublic ? 'Campagne publique' : 'Campagne privée'}</span>
          <span className="text-muted">{isPublic ? '· lien partageable' : '· créateurs connectés'}</span>
        </div>
        <form action={action}>
          <input type="hidden" name="campaign" value={campaignId} />
          <input type="hidden" name="is_public" value={isPublic ? 'false' : 'true'} />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-tap items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-xs font-bold text-ink transition hover:border-brand hover:text-brand disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (isPublic ? <EyeOff className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />)}
            {isPublic ? 'Rendre privée' : 'Rendre publique'}
          </button>
        </form>
      </div>
      {state.error && <p className="mt-2 text-xs text-rose-600">{state.error}</p>}
    </div>
  );
}
