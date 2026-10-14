// G4 / §2.2: the brand's contact-request form. Mirrors request_partner_contact's input checks so the
// form answers at once; the server stays the authority (and masks the goal/budget).
export const GOAL_MAX = 280;
export const BUDGET_MAX = 60;

export type ContactRequestError = 'invalid_goal' | 'budget_too_long' | 'deadline_in_past' | 'consent_required';

export interface ContactRequestInput { goal: string; budget?: string; deadline?: string; consent: boolean }

/** Goal is trimmed with spaces collapsed (as the server does) before the 1–280 check. */
export function normalizeGoal(goal: string): string {
  return goal.replace(/\s+/g, ' ').trim();
}

export function todayIso(now = new Date()): string {
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0'), d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Field errors in form order; empty when the request can be sent. */
export function validateContactRequest(input: ContactRequestInput, today = todayIso()): Partial<Record<'goal' | 'budget' | 'deadline' | 'consent', ContactRequestError>> {
  const errors: Partial<Record<'goal' | 'budget' | 'deadline' | 'consent', ContactRequestError>> = {};
  const goal = normalizeGoal(input.goal);
  if (goal.length < 1 || goal.length > GOAL_MAX) errors.goal = 'invalid_goal';
  if ((input.budget ?? '').trim().length > BUDGET_MAX) errors.budget = 'budget_too_long';
  const dl = (input.deadline ?? '').trim();
  if (dl && (!/^\d{4}-\d{2}-\d{2}$/.test(dl) || dl < today)) errors.deadline = 'deadline_in_past';
  if (!input.consent) errors.consent = 'consent_required';
  return errors;
}
