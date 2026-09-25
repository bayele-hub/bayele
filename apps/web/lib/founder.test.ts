import { describe, it, expect } from 'vitest';
import {
  FOUNDER_COHORT,
  formatFounderNumber,
  remainingToShow,
  founderOfferOpen,
  withCount,
  splitPayout,
  parseCommissionPct,
  formatPct,
} from './founder';

describe('founder badge', () => {
  it('matches the 10 000-creator milestone', () => {
    expect(FOUNDER_COHORT).toBe(10_000);
  });

  it('formats the badge number per locale', () => {
    expect(formatFounderNumber(42, 'fr')).toBe('n° 42');
    expect(formatFounderNumber(42, 'en')).toBe('#42');
  });

  it('never advertises an unknown or exhausted count', () => {
    expect(remainingToShow(null)).toBeNull();
    expect(remainingToShow(undefined)).toBeNull();
    expect(remainingToShow(Number.NaN)).toBeNull();
    expect(remainingToShow(0)).toBeNull();
    expect(remainingToShow(-3)).toBeNull();
    expect(remainingToShow(9_874)).toBe(9_874);
    expect(remainingToShow(99_999)).toBe(10_000);
  });

  it('treats an unknown count as open and zero as closed', () => {
    expect(founderOfferOpen(null)).toBe(true);
    expect(founderOfferOpen(1)).toBe(true);
    expect(founderOfferOpen(0)).toBe(false);
  });

  it('fills templates with locale-formatted counts', () => {
    expect(withCount('{n} left', 9874, 'en')).toBe('9,874 left');
    expect(withCount('{n} places', 9874, 'fr')).toMatch(/^9\s874 places$/u);
  });
});

describe('managed-creator payout split', () => {
  it('mirrors the database rounding (commission rounded down)', () => {
    expect(splitPayout(33_333, 0.15)).toEqual({ creator: 28_334, partner: 4_999 });
    expect(splitPayout(150_000, 0.1)).toEqual({ creator: 135_000, partner: 15_000 });
  });

  it('leaves independent deals untouched', () => {
    expect(splitPayout(35_000, null)).toEqual({ creator: 35_000, partner: 0 });
    expect(splitPayout(35_000, 0)).toEqual({ creator: 35_000, partner: 0 });
  });

  it('parses commission percents within 1–30 %', () => {
    expect(parseCommissionPct('15')).toBe(0.15);
    expect(parseCommissionPct('12,5')).toBe(0.125);
    expect(parseCommissionPct('0.5')).toBeNull();
    expect(parseCommissionPct('31')).toBeNull();
    expect(parseCommissionPct('abc')).toBeNull();
  });

  it('formats rates as percents', () => {
    expect(formatPct(0.15, 'en')).toBe('15%');
    expect(formatPct(0.125, 'fr')).toBe('12,5 %');
  });
});
