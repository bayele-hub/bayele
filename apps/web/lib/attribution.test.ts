import { describe, it, expect } from 'vitest';
import { parseSignupSource, parseRefHandle, effectiveSource, safeNextPath, SIGNUP_SOURCES } from './attribution';

describe('parseSignupSource — allow-list', () => {
  it('accepts the five sources (case/space tolerant)', () => {
    for (const s of SIGNUP_SOURCES) expect(parseSignupSource(s)).toBe(s);
    expect(parseSignupSource(' Campaigns_List ')).toBe('campaigns_list');
  });
  it('rejects anything else', () => {
    for (const s of ['', 'facebook', 'campaigns', null, undefined, 42, 'direct;drop']) expect(parseSignupSource(s)).toBeNull();
  });
});

describe('parseRefHandle — handle format', () => {
  it('accepts valid handles, tolerating @ and case', () => {
    expect(parseRefHandle('awa_creates')).toBe('awa_creates');
    expect(parseRefHandle('@Awa_Creates')).toBe('awa_creates');
    expect(parseRefHandle(' abc ')).toBe('abc');
  });
  it('rejects malformed values instead of rewriting them', () => {
    for (const s of ['ab', 'a'.repeat(31), 'awa creates', 'awa-creates', 'cléo', '../x', 'x?y=1', '', '@', null, 7]) {
      expect(parseRefHandle(s), String(s)).toBeNull();
    }
  });
});

describe('effectiveSource', () => {
  it('a ref always means referral', () => {
    expect(effectiveSource('campaigns_list', 'awa')).toBe('referral');
    expect(effectiveSource(null, 'awa')).toBe('referral');
  });
  it('keeps the source without a ref', () => {
    expect(effectiveSource('campaign_page', null)).toBe('campaign_page');
    expect(effectiveSource(null, null)).toBeNull();
  });
});

describe('safeNextPath — same-origin only', () => {
  it('accepts internal paths', () => {
    expect(safeNextPath('/creator/campaigns?alert_country=NG#alertes')).toBe('/creator/campaigns?alert_country=NG#alertes');
    expect(safeNextPath('/')).toBe('/');
  });
  it('rejects external and protocol-relative URLs', () => {
    for (const s of ['//evil.com', '/\\evil.com', 'https://evil.com', 'evil.com', '', null, '/x\r\nSet-Cookie: a=b']) {
      expect(safeNextPath(s), String(s)).toBeNull();
    }
  });
});

// QA D1: open redirect via control/whitespace characters. Values arrive URL-decoded from the query
// string (searchParams), so each payload is tested as the browser would deliver it.
describe('safeNextPath — QA D1 open-redirect payloads', () => {
  const fromQuery = (raw: string) => new URLSearchParams(`next=${raw}`).get('next');
  const PAYLOADS = [
    // QA repro
    '%09%2Fevil.com', '%2F%09%2Fevil.com', '/%09/evil.com', '/%0B/evil.com', '/%0C/evil.com', '/%20/evil.com', '/%E3%80%80/evil.com',
    // requested extras
    '%09', '/%0d%0a/evil.com', '%0d%0a', '/%5C%5Cevil', '/%5Cevil', '//evil', '%2F%2Fevil', 'https:evil', 'https://evil.com', '/%2F%2Fevil',
    '/%252F%252Fevil', '/%E2%80%8B/evil.com', '/%C2%A0/evil.com', '/x%0Ay',
  ];
  for (const raw of PAYLOADS) {
    it(`rejects next=${raw}`, () => {
      const v = fromQuery(raw);
      expect(safeNextPath(v), JSON.stringify(v)).toBeNull();
    });
  }
  it('rejects raw tab / CR / LF / backslash forms', () => {
    for (const v of ['/\t/evil.com', '/\r\n/evil.com', '/\\evil', '/\\\\evil', '\t/x', '/x　']) expect(safeNextPath(v), JSON.stringify(v)).toBeNull();
  });
  it('every accepted value resolves on our own origin', () => {
    for (const v of ['/campaigns/abc', '/creator/campaigns?alert_country=NG&alert_cat=beaute#alertes', '/a/b?x=1%2C2']) {
      const s = safeNextPath(v);
      expect(s).toBe(v);
      expect(new URL(s!, 'https://bayele.com').host).toBe('bayele.com');
    }
  });
});
