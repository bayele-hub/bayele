'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { withdrawRequestAction } from './actions';

/** « Retirer la demande » with an inline confirm (§2.3). */
export function WithdrawButton({ requestId, L }: { requestId: string; L: { withdraw: string; withdrawConfirm: string; withdrawYes: string; withdrawn: string; cancel: string } }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (msg?.ok) return <p role="status" className="text-xs font-semibold text-emerald-700">{msg.text}</p>;
  return (
    <div className="min-w-0">
      {!confirm ? (
        <button type="button" onClick={() => setConfirm(true)} className="inline-flex min-h-tap items-center rounded-xl px-2 text-xs font-bold text-rose-700 hover:bg-rose-50">{L.withdraw}</button>
      ) : (
        <div role="group" className="space-y-2 rounded-xl bg-surface p-2" onKeyDown={(e) => { if (e.key === 'Escape') setConfirm(false); }}>
          <p className="text-xs text-ink">{L.withdrawConfirm}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setConfirm(false)} className="inline-flex min-h-tap items-center rounded-xl border border-line bg-white px-3 text-xs font-bold text-ink">{L.cancel}</button>
            <button type="button" disabled={pending} autoFocus onClick={() => start(async () => {
              const r = await withdrawRequestAction(requestId);
              setMsg(r.ok ? { ok: true, text: L.withdrawn } : { ok: false, text: r.error ?? '' });
              if (r.ok) router.refresh();
            })} className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-rose-700 px-3 text-xs font-bold text-white">
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />} {L.withdrawYes}
            </button>
          </div>
        </div>
      )}
      {msg && !msg.ok && <p role="alert" className="text-xs font-semibold text-rose-700">{msg.text}</p>}
    </div>
  );
}
