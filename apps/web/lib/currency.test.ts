import { describe, it, expect } from 'vitest';
import { currencyFor } from '@bayele/sokoclick-sdk';

describe('currencyFor (spec §0.1 #F)', () => {
  it('uses XOF for Côte d’Ivoire (UEMOA)', () => expect(currencyFor('CI')).toBe('XOF'));
  it('uses XAF for Cameroon and Gabon (CEMAC)', () => {
    expect(currencyFor('CM')).toBe('XAF');
    expect(currencyFor('GA')).toBe('XAF');
  });
});
