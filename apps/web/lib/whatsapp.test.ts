import { describe, it, expect, afterEach, vi } from 'vitest';
import { bayeleWhatsappHref, bayeleWhatsappNumber, parseWhatsappNumber, publishMessage, waMeHref } from './whatsapp';
import fr from '../messages/fr.json';
import en from '../messages/en.json';

describe('WhatsApp link builder (K5)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('accepts E.164 digits only (8–15), tolerating + and spaces', () => {
    expect(parseWhatsappNumber('237690000000')).toBe('237690000000');
    expect(parseWhatsappNumber('+237 690 000 000')).toBe('237690000000');
    expect(parseWhatsappNumber('1234567')).toBeNull();
    expect(parseWhatsappNumber('12345678901234567')).toBeNull();
    expect(parseWhatsappNumber('abc')).toBeNull();
    expect(parseWhatsappNumber(undefined)).toBeNull();
  });

  it('unset or invalid env → no link (the CTA is not rendered)', () => {
    vi.stubEnv('NEXT_PUBLIC_BAYELE_WHATSAPP', '');
    expect(bayeleWhatsappNumber()).toBeNull();
    expect(bayeleWhatsappHref('x')).toBeNull();
    vi.stubEnv('NEXT_PUBLIC_BAYELE_WHATSAPP', 'not-a-number');
    expect(bayeleWhatsappHref('x')).toBeNull();
  });

  it('set env → wa.me/<digits>?text=<encoded>', () => {
    vi.stubEnv('NEXT_PUBLIC_BAYELE_WHATSAPP', '+2250700000000');
    expect(bayeleWhatsappHref('Bonjour & merci')).toBe('https://wa.me/2250700000000?text=Bonjour%20%26%20merci');
    expect(waMeHref('+237 690', 'x')).toBeNull();
  });

  it('prefilled brief message FR/EN: the 6 questions, answers inserted, empty ones blank, source code last', () => {
    const msg = publishMessage(fr.publishWhatsapp.message, { what: '3 vidéos courtes', where: 'Douala, Cameroun' }, 'new-campaign');
    const lines = msg.split('\n');
    expect(lines).toHaveLength(8);
    expect(lines[1]).toBe('1. Ce que je veux (vidéos, photos…) : 3 vidéos courtes');
    expect(lines[3]).toBe('3. Ville et pays : Douala, Cameroun');
    expect(lines[4]).toBe('4. Date limite : ');
    expect(lines[7]).toBe('Réf. : new-campaign');
    const enMsg = publishMessage(en.publishWhatsapp.message, {}, 'home');
    expect(enMsg).toContain('Ref: home');
    expect(enMsg).not.toMatch(/\{\w+\}/);
  });
});
