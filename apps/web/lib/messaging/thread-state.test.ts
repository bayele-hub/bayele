import { describe, it, expect } from 'vitest';
import { appendMessage, seedThread, THREAD_CAP, type MessageLike, type ThreadState } from './thread-state';

const m = (id: string, t: string): MessageLike => ({ id, created_at: t });
const state = (ms: MessageLike[]): ThreadState<MessageLike> => ({ messages: ms });

describe('appendMessage', () => {
  it('appends in chronological order regardless of arrival order', () => {
    let s = state([m('a', '2026-01-01T00:00:01Z')]);
    s = appendMessage(s, m('c', '2026-01-01T00:00:03Z'));
    s = appendMessage(s, m('b', '2026-01-01T00:00:02Z')); // arrives out of order
    expect(s.messages.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('deduplicates by id (realtime echo of an optimistic send) — same reference', () => {
    const start = state([m('a', '2026-01-01T00:00:01Z')]);
    const s = appendMessage(start, m('a', '2026-01-01T00:00:01Z'));
    expect(s).toBe(start);
    expect(s.messages).toHaveLength(1);
  });

  it('caps the in-memory thread at THREAD_CAP, keeping the newest', () => {
    let s = state([]);
    for (let i = 0; i < THREAD_CAP + 10; i++) s = appendMessage(s, m(`x${i}`, isoAt(i)));
    expect(s.messages).toHaveLength(THREAD_CAP);
    expect(s.messages[0]?.id).toBe('x10'); // oldest 10 dropped
    expect(s.messages[s.messages.length - 1]?.id).toBe(`x${THREAD_CAP + 9}`);
  });
});

describe('seedThread', () => {
  it('dedups and sorts an initial batch', () => {
    const s = seedThread([m('b', '2026-01-01T00:00:02Z'), m('a', '2026-01-01T00:00:01Z'), m('b', '2026-01-01T00:00:02Z')]);
    expect(s.messages.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('keeps only the newest THREAD_CAP', () => {
    const arr = Array.from({ length: THREAD_CAP + 5 }, (_, i) => m(`x${i}`, isoAt(i)));
    const s = seedThread(arr);
    expect(s.messages).toHaveLength(THREAD_CAP);
    expect(s.messages[0]?.id).toBe('x5');
  });
});

// Monotonic ISO timestamps for ordering tests (one minute apart, zero-padded, lexicographically sortable).
function isoAt(i: number): string {
  const base = Date.UTC(2026, 0, 1, 0, 0, 0) + i * 60000;
  const d = new Date(base);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}Z`;
}
