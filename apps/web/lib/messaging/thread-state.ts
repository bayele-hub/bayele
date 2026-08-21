/**
 * Pure state transitions for a message thread. Kept out of the component so the merge rules —
 * dedup by id, chronological order, and the memory cap — are unit-testable and can't drift.
 *
 * Messages reach the thread from two sources that can overlap: the server-rendered initial page and
 * the live realtime INSERT stream (which echoes the sender's OWN message too). Dedup by id makes both
 * an optimistic local append and the realtime echo converge on a single row.
 */

export interface MessageLike {
  id: string;
  created_at: string; // ISO 8601 — sorts chronologically as a string
}

export interface ThreadState<T extends MessageLike> {
  messages: T[];
}

/** Keep at most this many messages in memory (a long thread pages the rest server-side). */
export const THREAD_CAP = 500;

function byCreatedAt<T extends MessageLike>(a: T, b: T): number {
  if (a.created_at < b.created_at) return -1;
  if (a.created_at > b.created_at) return 1;
  return 0;
}

/**
 * Add one message, deduplicated by id and kept in chronological order (oldest first). A no-op
 * (returns the same reference) when the id is already present, so realtime echoes never duplicate.
 */
export function appendMessage<T extends MessageLike>(state: ThreadState<T>, m: T): ThreadState<T> {
  if (state.messages.some((x) => x.id === m.id)) return state;
  const messages = [...state.messages, m].sort(byCreatedAt);
  return { messages: messages.length > THREAD_CAP ? messages.slice(messages.length - THREAD_CAP) : messages };
}

/** Normalize an initial batch (dedup + sort + cap) — used to seed the thread from the server page. */
export function seedThread<T extends MessageLike>(initial: T[]): ThreadState<T> {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const m of initial) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    deduped.push(m);
  }
  deduped.sort(byCreatedAt);
  return { messages: deduped.length > THREAD_CAP ? deduped.slice(deduped.length - THREAD_CAP) : deduped };
}
