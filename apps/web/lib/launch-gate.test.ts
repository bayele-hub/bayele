import { describe, it, expect } from 'vitest';
import { CREATOR_DIRECTORY_THRESHOLD, isCreatorDirectoryOpen, parseDirectoryOverride } from './launch-gate';

describe('creator directory launch gate', () => {
  it('uses the 10 000-creator milestone', () => {
    expect(CREATOR_DIRECTORY_THRESHOLD).toBe(10_000);
  });

  it('stays closed below the threshold and opens at it', () => {
    expect(isCreatorDirectoryOpen(0)).toBe(false);
    expect(isCreatorDirectoryOpen(9_999)).toBe(false);
    expect(isCreatorDirectoryOpen(10_000)).toBe(true);
    expect(isCreatorDirectoryOpen(25_000)).toBe(true);
  });

  it('fails closed when the count is unknown', () => {
    expect(isCreatorDirectoryOpen(null)).toBe(false);
    expect(isCreatorDirectoryOpen(Number.NaN)).toBe(false);
  });

  it('honors a manual override in both directions', () => {
    expect(isCreatorDirectoryOpen(0, CREATOR_DIRECTORY_THRESHOLD, 'open')).toBe(true);
    expect(isCreatorDirectoryOpen(50_000, CREATOR_DIRECTORY_THRESHOLD, 'closed')).toBe(false);
  });

  it('parses only explicit override values', () => {
    expect(parseDirectoryOverride('open')).toBe('open');
    expect(parseDirectoryOverride(' CLOSED ')).toBe('closed');
    expect(parseDirectoryOverride('yes')).toBeNull();
    expect(parseDirectoryOverride(undefined)).toBeNull();
  });
});
