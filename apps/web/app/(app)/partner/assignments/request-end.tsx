'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Dictionary } from '@/i18n/dictionaries';
import { ReasonPanel } from '@/components/gov/reason-panel';
import { requestAssignmentEndAction } from './actions';

/** « Demander la fin » text button → inline panel (reason required, 1–300). */
export function RequestEnd({ P, assignmentId }: { P: Dictionary['partnerAssignments']; assignmentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return <p role="status" className="text-xs font-semibold text-emerald-700">{P.sent}</p>;
  return (
    <div className="min-w-0">
      {!open && <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-tap items-center rounded-xl px-3 text-sm font-bold text-ink underline-offset-2 hover:underline">{P.requestEnd}</button>}
      {open && (
        <ReasonPanel id={`req-end-${assignmentId}`} title={P.requestEndTitle} effect={P.requestEndHelp} label={P.requestEndReason} required max={300}
          submitLabel={P.requestEndSubmit} cancelLabel={P.cancel} onCancel={() => setOpen(false)}
          onSubmit={async (text) => {
            const r = await requestAssignmentEndAction(assignmentId, text);
            if (!r.ok) return r.error ?? P.errors.generic;
            setOpen(false); setDone(true); router.refresh();
            return null;
          }} />
      )}
    </div>
  );
}
