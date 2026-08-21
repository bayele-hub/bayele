import { describe, it, expect } from 'vitest';
import { addIncoming, markOneRead, markAllRead, NOTIF_CAP, type NotifState, type NotifLike } from './state';

const n = (id: string, read = false): NotifLike => ({ id, read_at: read ? '2026-01-01T00:00:00Z' : null });
const NOW = '2026-08-21T12:00:00Z';

function state(items: NotifLike[], unread: number): NotifState<NotifLike> {
  return { items, unread };
}

describe('addIncoming', () => {
  it('prepends an unread notification and bumps the badge', () => {
    const s = addIncoming(state([n('a', true)], 0), n('b'));
    expect(s.items.map((i) => i.id)).toEqual(['b', 'a']);
    expect(s.unread).toBe(1);
  });

  it('does not bump the badge for an already-read incoming', () => {
    const s = addIncoming(state([], 0), n('b', true));
    expect(s.unread).toBe(0);
    expect(s.items).toHaveLength(1);
  });

  it('deduplicates by id (realtime replay / snapshot overlap) — no double count', () => {
    const start = state([n('a')], 1);
    const s = addIncoming(start, n('a'));
    expect(s).toBe(start); // unchanged reference
    expect(s.unread).toBe(1);
    expect(s.items).toHaveLength(1);
  });

  it('caps the in-memory list at NOTIF_CAP', () => {
    let s = state([], 0);
    for (let i = 0; i < NOTIF_CAP + 5; i++) s = addIncoming(s, n(`x${i}`));
    expect(s.items).toHaveLength(NOTIF_CAP);
    expect(s.items[0]?.id).toBe(`x${NOTIF_CAP + 4}`); // newest kept
    expect(s.unread).toBe(NOTIF_CAP + 5); // badge counts every unread, even beyond the page
  });
});

describe('markOneRead', () => {
  it('marks an unread item read and decrements the badge', () => {
    const s = markOneRead(state([n('a'), n('b')], 2), 'a', NOW);
    expect(s.items.find((i) => i.id === 'a')?.read_at).toBe(NOW);
    expect(s.items.find((i) => i.id === 'b')?.read_at).toBeNull();
    expect(s.unread).toBe(1);
  });

  it('is a no-op on an already-read item (no negative badge)', () => {
    const s = markOneRead(state([n('a', true)], 0), 'a', NOW);
    expect(s.unread).toBe(0);
  });

  it('ignores an id that is not in the list', () => {
    const s = markOneRead(state([n('a')], 1), 'missing', NOW);
    expect(s.unread).toBe(1);
    expect(s.items.find((i) => i.id === 'a')?.read_at).toBeNull();
  });
});

describe('markAllRead', () => {
  it('reads everything and zeroes the badge', () => {
    const s = markAllRead(state([n('a'), n('b', true), n('c')], 2), NOW);
    expect(s.unread).toBe(0);
    expect(s.items.every((i) => i.read_at !== null)).toBe(true);
    // an already-read item keeps its original timestamp, not NOW
    expect(s.items.find((i) => i.id === 'b')?.read_at).toBe('2026-01-01T00:00:00Z');
    expect(s.items.find((i) => i.id === 'a')?.read_at).toBe(NOW);
  });

  it('zeroes the badge even when unread exceeds the in-memory page', () => {
    const s = markAllRead(state([n('a')], 37), NOW);
    expect(s.unread).toBe(0);
  });
});
