import { describe, it, expect } from 'vitest';
import { ddmmyyyy, nudgeText, orderFormText, type OrderFormInput } from './managed-order-form';

const b: OrderFormInput = {
  brandName: 'Saveurs du Wouri SARL', brandLabel: 'Restaurant', brandConsent: false, city: 'Douala', country: 'CM',
  contactName: 'Awa', contactWhatsapp: '+237690000000', title: 'Pack contenu food', deliverableType: 'short_video',
  deliverableCount: 5, deliverables: '10 photos du menu et 5 vidéos. Ambiance soir.', places: 2, language: 'Français',
  deadline: '2026-10-28', rightsText: 'Usage organique sur les réseaux de la marque, Cameroun, 6 mois.', totalBudget: 70000,
};

describe('order form (plan §3) and nudges', () => {
  it('FR: the plan template with blanks filled, per-creator amount when places > 1', () => {
    const t = orderFormText(b, 'fr');
    expect(t.split('\n')[0]).toBe('BON DE COMMANDE — Campagne gérée par Bayele');
    expect(t).toContain('affichage public : ☐ nom réel  ☑ « Restaurant · Douala »');
    expect(t).toContain('Livrables : 5 vidéos courtes par créateur — 10 photos du menu et 5 vidéos');
    expect(t).toContain('Date limite de livraison : 28/10/2026');
    expect(t).toContain('Budget total : 70 000 FCFA');
    expect(t).toContain('rémunération créateurs : 52 500 FCFA (soit 26 250 FCFA par créateur)');
    expect(t.trim().endsWith('Répondez « OUI » pour valider.')).toBe(true);
    expect(t).not.toMatch(/ [:?!;%]/);
  });
  it('EN version and blanks', () => {
    const t = orderFormText({ ...b, totalBudget: null, deadline: '', brandConsent: true }, 'en');
    expect(t).toContain('ORDER FORM — Campaign managed by Bayele');
    expect(t).toContain('☑ real name');
    expect(t).toContain('Delivery deadline: ……/……/……');
    expect(t).toContain('Total budget: ……… FCFA');
    expect(t).toContain('Reply "YES" to confirm.');
    expect(ddmmyyyy('2026-01-05')).toBe('05/01/2026');
  });
  it('nudges fill their placeholders and tidy an empty contact', () => {
    expect(nudgeText('order', 'fr', { contact: '', service: 'Pack' })).toMatch(/^Bonjour, petit rappel/);
    expect(nudgeText('payment', 'en', { contact: 'Awa', service: 'Pack', total: '70,000 FCFA' })).toContain('payment of 70,000 FCFA');
    expect(nudgeText('counterOffer', 'fr', { contact: 'Awa', service: 'Pack', net: 'a', total: 'b', qty: 'c' })).not.toMatch(/\{\w+\}/);
  });
});
