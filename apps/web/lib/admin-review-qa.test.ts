import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fr from '../messages/fr.json';
import en from '../messages/en.json';
import { followersTotal, parseAudience } from './profile-limits';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const src = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('AR-1: the typed audience is never replaced by the followers sum', () => {
  it('parseAudience keeps typed numbers, returns null (= keep stored) for blank or malformed input', () => {
    expect(parseAudience('48000')).toBe(48000);
    expect(parseAudience('48 000')).toBe(48000);
    expect(parseAudience('0')).toBe(0);
    expect(parseAudience('')).toBeNull();
    expect(parseAudience(null)).toBeNull();
    expect(parseAudience('-5')).toBeNull();
    expect(parseAudience('abc')).toBeNull();
    expect(followersTotal({ instagram: { followers: 9800 }, tiktok: { followers: 2600 }, x: null })).toBe(12400);
  });

  type Call = { table: string; payload: Record<string, unknown> };
  let calls: Call[];
  beforeEach(() => {
    calls = [];
    vi.resetModules();
    const client = {
      from: (table: string) => ({
        update: (payload: Record<string, unknown>) => {
          calls.push({ table, payload });
          return { eq: async () => ({ error: null }) };
        },
      }),
    };
    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => client }));
    vi.doMock('@/lib/auth/session', () => ({ getSession: async () => ({ userId: 'u-legacy', roles: ['creator'], primary: 'creator' }) }));
    vi.doMock('@/i18n/dictionaries', () => ({ getDictionary: async () => ({ locale: 'fr', t: fr }) }));
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }));
    vi.doMock('next/navigation', () => ({ redirect: vi.fn() }));
    vi.doMock('@/lib/data/partner-gov', () => ({ getSpecialties: async () => [] }));
  });

  function legacyForm(audience: string | null): FormData {
    const f = new FormData();
    f.set('display_name', 'Awa');
    f.set('city', 'Douala');
    f.set('country', 'CM');
    f.set('bio', '');
    f.set('categories', 'Mode');
    f.set('momo_phone', '');
    f.set('momo_provider', 'mtn_momo');
    // Legacy creator: URL-only platform, no per-network counts.
    f.set('soc_instagram_url', 'https://instagram.com/awa');
    f.set('soc_instagram_followers', '');
    if (audience !== null) f.set('audience_size', audience);
    return f;
  }

  it('a legacy creator with audience 48000 and no per-network counts saves the profile: audience stays 48000', async () => {
    const { updateProfileAction } = await import('../app/(app)/profile/actions');
    const res = await updateProfileAction({ error: null }, legacyForm('48000'));
    expect(res).toEqual({ error: null, ok: true });
    const creator = calls.find((c) => c.table === 'creator_profiles')!;
    expect(creator.payload.audience_size).toBe(48000);
  });

  it('a save without the audience field (or blank) never writes audience_size', async () => {
    const { updateProfileAction } = await import('../app/(app)/profile/actions');
    for (const v of [null, '']) {
      calls.length = 0;
      await updateProfileAction({ error: null }, legacyForm(v));
      const creator = calls.find((c) => c.table === 'creator_profiles')!;
      expect(creator.payload).not.toHaveProperty('audience_size');
    }
  });

  it('the profile form pre-fills the stored audience and shows the networks total only as a hint', async () => {
    const { AudienceField } = await import('../components/audience-field');
    const html = renderToStaticMarkup(createElement(AudienceField, { label: 'Audience', defaultValue: 48000, networksTotal: 0, networksTemplate: fr.creatorForm.audienceNetworks, locale: 'fr' }));
    expect(html).toContain('name="audience_size"');
    expect(html).toContain('value="48000"');
    expect(html).not.toContain('Total de vos réseaux');
    const withHint = renderToStaticMarkup(createElement(AudienceField, { label: 'Audience', defaultValue: 48000, networksTotal: 12400, networksTemplate: fr.creatorForm.audienceNetworks, locale: 'fr' }));
    expect(withHint).toMatch(/Total de vos réseaux : 12 400/);
    expect(src('app/(app)/profile/actions.ts')).not.toMatch(/audience_size:\s*followersSum/);
    expect(src('app/(auth)/onboarding/actions.ts')).not.toMatch(/followersSum/);
    expect(src('app/(auth)/onboarding/[role]/onboarding-form.tsx')).toContain('<AudienceField');
  });
});

describe('AR-2 / AR-3 / AR-6', () => {
  it('partner specialties are labelled « Spécialités déclarées » (G1 replaces the AR-2 « Non vérifié » tag)', () => {
    expect(fr.specialties.publicHeading).toBe('Spécialités déclarées');
    expect(en.specialties.publicHeading).toBe('Declared specialties');
    expect(en.specialties.publicTip).toBeTruthy();
    expect(src('app/(public)/partners/[handle]/page.tsx')).toContain('t.specialties.publicHeading');
    expect(src('app/(public)/partners/[handle]/page.tsx')).not.toContain('t.profile.unverified');
  });

  it('no hard-coded French rating or tooltip labels in shared or creator screens', () => {
    expect(src('components/talent-grid.tsx')).not.toContain("'Nouveau'");
    expect(src('app/(app)/creator/wallet/page.tsx')).not.toContain('label="En cours"');
    expect(src('app/(app)/creator/dashboard/page.tsx')).not.toContain('label="Commission partenaire"');
    expect(en.creatorUx.walletInProgress).toBe('In progress');
    expect(en.creatorUx.partnerCommission).toBe('Partner commission');
  });

  it('member name links and social links have a 44 px hit area', () => {
    expect(src('components/admin/member-card.tsx')).toMatch(/-my-2\.5 block truncate py-2\.5/);
    expect(src('app/(app)/admin/users/[id]/page.tsx')).toMatch(/<a href=\{v\.url\}[^>]*min-h-\[44px\]/);
  });
});
