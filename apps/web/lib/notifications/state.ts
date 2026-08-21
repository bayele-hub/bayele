/**
 * Pure state transitions for the notification bell. Kept out of the component so the interaction
 * rules — dedup on live insert, per-item read, mark-all, and the unread counter — are unit-testable
 * and don't drift. `unread` is tracked independently of `items` because the badge counts ALL unread
 * notifications while `items` holds only the most recent page.
 */

export interface NotifLike {
  id: string;
  read_at: string | null;
}

export interface NotifState<T extends NotifLike> {
  items: T[];
  unread: number;
}

/** How many notifications the bell keeps in memory (matches the server-side initial fetch). */
export const NOTIF_CAP = 20;

/**
 * Apply a live-inserted notification. Deduplicated by id so a realtime replay, or an insert that
 * overlaps the server's initial snapshot, can't double-count the badge or duplicate a React key.
 */
export function addIncoming<T extends NotifLike>(state: NotifState<T>, n: T): NotifState<T> {
  if (state.items.some((i) => i.id === n.id)) return state;
  return {
    items: [n, ...state.items].slice(0, NOTIF_CAP),
    unread: state.unread + (n.read_at ? 0 : 1),
  };
}

/** Mark one notification read (e.g. the user opened it). Decrements unread only if it was unread. */
export function markOneRead<T extends NotifLike>(state: NotifState<T>, id: string, nowIso: string): NotifState<T> {
  let decremented = 0;
  const items = state.items.map((i) => {
    if (i.id === id && !i.read_at) {
      decremented = 1;
      return { ...i, read_at: nowIso };
    }
    return i;
  });
  return { items, unread: Math.max(0, state.unread - decremented) };
}

/** Mark everything read. Clears the badge fully (including unread beyond the in-memory page). */
export function markAllRead<T extends NotifLike>(state: NotifState<T>, nowIso: string): NotifState<T> {
  return {
    items: state.items.map((i) => (i.read_at ? i : { ...i, read_at: nowIso })),
    unread: 0,
  };
}
