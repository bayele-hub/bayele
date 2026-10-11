import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fr from '../messages/fr.json';

// QA D1: no SectionTip trigger may ever sit inside a disabled <fieldset> (tips must work on locked /
// saving briefs). Render the real editor for a LOCKED brief and walk the markup.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, replace() {}, refresh() {} }) }));
vi.mock('../app/(app)/admin/briefs/actions', () => ({
  saveBriefAction: vi.fn(), publishBriefAction: vi.fn(), declineBriefAction: vi.fn(), setBriefStatusAction: vi.fn(), duplicateBriefAction: vi.fn(),
}));

const { BriefEditor } = await import('../app/(app)/admin/briefs/_components/brief-editor');

const row = {
  id: '11111111-1111-4111-8111-111111111111', brand_name: 'Saveurs du Wouri SARL', brand_label: 'Saveurs du Wouri', brand_consent: true,
  brand_consent_proof: 'capture', contact_name: 'Awa', contact_whatsapp: '+237690000000', country: 'CM', city: 'Douala', sector: 'Immobilier',
  category: 'Immobilier', service: 'Visites vidéo', title: null, deliverables: 'Tournage.', deliverable_type: 'short_video', deliverable_count: 4,
  places: 1, total_budget_fcfa: 80000, platforms: ['instagram'], content_type: 'Vidéo courte (Reel, TikTok, Short)', language: 'Français',
  usage_rights: 'Usage organique sur les réseaux de la marque, Cameroun, 6 mois.', creator_requirements: 'Vidéaste', equipment: null,
  claims_verified: true, deadline: '2026-12-01', order_confirmed_at: '2026-10-10T10:00:00Z', order_proof: 'capture', deposit_status: 'none',
  status: 'awaiting_payment', notes: null, campaign_id: '22222222-2222-4222-8222-222222222222', floor_check: 'not_set',
  decline_reason: null, declined_at: null, created_by: null, created_at: '2026-10-10T09:00:00Z', updated_at: '2026-10-10T10:00:00Z',
} as const;

/** Help-button labels found inside a disabled fieldset (tiny tag walker; the markup is well-formed). */
function tipsInsideDisabled(html: string): string[] {
  const stack: boolean[] = [];
  const bad: string[] = [];
  for (const m of html.matchAll(/<(\/?)(fieldset|button)\b([^>]*)>/g)) {
    const [, close, tag, attrs] = m;
    if (tag === 'fieldset') {
      if (close) stack.pop();
      else stack.push(/\sdisabled(=|\s|$)/.test(attrs ?? ''));
    } else if (!close) {
      const label = /aria-label="([^"]*)"/.exec(attrs ?? '')?.[1] ?? '';
      if (label.startsWith('Aide') && stack.includes(true)) bad.push(label);
    }
  }
  return bad;
}

describe('section tips stay operable on a locked brief (QA D1)', () => {
  const html = renderToStaticMarkup(
    createElement(BriefEditor, {
      row: row as never, campaignStatus: 'pending_funding', floors: {}, floorsAvailable: true, L: fr.admin.briefs,
      badge: fr.managed.badge, categoryLabels: fr.categories, locale: 'fr', today: '2026-10-11',
    }),
  );
  it('renders the tips, including Net par place, the floor, consent and claims', () => {
    for (const k of ['netPay', 'floor', 'consent', 'claims', 'brandLocked']) expect(html, k).toContain(`id="tip-${k}"`);
  });
  it('the walker itself catches a tip inside a disabled fieldset', () => {
    expect(tipsInsideDisabled('<fieldset disabled=""><p><button aria-label="Aide : X"></button></p></fieldset>')).toEqual(['Aide : X']);
    expect(tipsInsideDisabled('<fieldset disabled=""></fieldset><button aria-label="Aide : Y"></button>')).toEqual([]);
  });
  it('no « Aide » trigger is a descendant of a disabled fieldset', () => {
    expect(html).toMatch(/<fieldset[^>]*disabled/); // the listing really is locked
    expect(tipsInsideDisabled(html)).toEqual([]);
  });
});
