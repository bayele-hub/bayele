'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { alertSignupHref } from '@/lib/auth/campaign-ctas';
import { parseRefHandle } from '@/lib/attribution';
import { categoryValue } from '@/lib/campaign-categories';
import { alertErrorKey, parseAlertFilters, type AlertState } from './state';

/**
 * Campaign-alert opt-in (design §4). Works without JavaScript (plain form POST to this action).
 *   - logged out → nothing is written; redirect to creator sign-up, returning to
 *     /creator/campaigns with the chosen filters for a one-tap confirm;
 *   - signed in  → subscribe_campaign_alert (the RPC enforces auth, profile and the 5-alert cap).
 * Duplicates are detected first so the UI can say « Vous avez déjà cette alerte. ».
 */
export async function subscribeAlertAction(_prev: AlertState, formData: FormData): Promise<AlertState> {
  const parsed = parseAlertFilters(formData.get('country'), formData.get('cat'));
  if (!parsed.ok) return { status: 'error', error: 'invalid' };
  const { country, cat } = parsed;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(alertSignupHref({ country, cat, ref: parseRefHandle(formData.get('ref')) }));
  }

  const category = categoryValue(cat);
  const { data: existing } = await supabase.rpc('my_campaign_alerts');
  const dup = (existing ?? []).some(
    (a) => (a.country ?? null) === country && (a.category ?? '').toLocaleLowerCase('fr') === (category ?? '').toLocaleLowerCase('fr'),
  );
  if (dup) return { status: 'duplicate', country, cat };

  const { error } = await supabase.rpc('subscribe_campaign_alert', {
    p_country: country ?? undefined,
    p_category: category ?? undefined,
  });
  if (error) return { status: 'error', error: alertErrorKey(error.message) };

  revalidatePath('/creator/campaigns');
  return { status: 'ok', country, cat };
}

/** Remove one of my alerts (chip × button). No-JS friendly: redirects back to the alerts section. */
export async function removeAlertAction(formData: FormData): Promise<void> {
  const id = String(formData.get('alert') ?? '');
  const supabase = await createClient();
  const { data, error } = id ? await supabase.rpc('unsubscribe_campaign_alert', { p_alert_id: id }) : { data: false, error: null };
  revalidatePath('/creator/campaigns');
  const msg = !error && data ? 'removed' : 'remove_error';
  redirect(`/creator/campaigns?alerts_msg=${msg}#alertes`);
}
