'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { getDictionary } from '@/i18n/dictionaries';
import { consentErrorMessage, mapCode } from '@/lib/gov/rules';
import { NON_CIRCUMVENTION_VERSION } from '@/lib/legal';
import { normalizeGoal, validateContactRequest } from '@/lib/gov/contact-request';
import { currentConsentRecorded } from '@/lib/gov/consent-check';

export type RequestState = {
  error: string | null;
  field?: 'goal' | 'budget' | 'deadline' | 'consent' | null;
  code?: string | null;
  values?: { goal: string; budget: string; deadline: string };
};

const FIELD_OF: Record<string, RequestState['field']> = {
  invalid_goal: 'goal', budget_too_long: 'budget', deadline_in_past: 'deadline', consent_required: 'consent',
};

/** §2.2: request_partner_contact(…, NON_CIRCUMVENTION_VERSION) → /business/partners?sent=1. */
export async function requestPartnerAction(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  const { t } = await getDictionary();
  const E = t.partnerRequest.errors as Record<string, string>;
  const partnerId = String(formData.get('partner_id') ?? '');
  const values = {
    goal: String(formData.get('goal') ?? ''),
    budget: String(formData.get('budget') ?? ''),
    deadline: String(formData.get('deadline') ?? ''),
  };
  const consent = formData.get('consent') === 'on';
  const errs = validateContactRequest({ ...values, consent });
  const first = (['goal', 'budget', 'deadline', 'consent'] as const).find((k) => errs[k]);
  if (first) return { error: E[errs[first]!]!, field: first, code: errs[first]!, values };

  // PG-6: the one-time acknowledgement (current version) must be on record, read via my_consents().
  if (!(await currentConsentRecorded())) return { error: t.consent.requiredError, field: null, code: 'consent_not_recorded', values };

  const supabase = await createClient();
  const { error } = await supabase.rpc('request_partner_contact', {
    p_partner_id: partnerId,
    p_goal: normalizeGoal(values.goal),
    p_budget_range: values.budget.trim() || undefined,
    p_deadline: values.deadline.trim() || undefined,
    p_consent_version: NON_CIRCUMVENTION_VERSION,
  });
  if (error) {
    const code = (error.message ?? '').trim();
    // PG-12: a stale brand acknowledgement (details 'brand') isn't the tick box — ask to reload and accept.
    const consentMsg = consentErrorMessage(code, error.details, t.consent);
    if (consentMsg) return { error: consentMsg, field: null, code, values };
    return { error: mapCode(E, code, E.generic!), field: FIELD_OF[code] ?? null, code, values };
  }
  revalidatePath('/business/partners');
  redirect('/business/partners?sent=1');
}

/** « Retirer la demande » while pending (withdraw_contact_request). */
export async function withdrawRequestAction(requestId: string): Promise<{ ok: boolean; error?: string }> {
  const { t } = await getDictionary();
  const E = t.businessPartners.errors as Record<string, string>;
  const supabase = await createClient();
  const { error } = await supabase.rpc('withdraw_contact_request', { p_request_id: requestId });
  if (error) return { ok: false, error: mapCode(E, error.message, E.generic!) };
  revalidatePath('/business/partners');
  return { ok: true };
}
