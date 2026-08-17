'use client';

import { useActionState, useMemo, useState } from 'react';
import { Check, X, Loader2, MapPin, Ban, RotateCcw, Search } from 'lucide-react';
import { moderateAction, type ModerateState } from './actions';

export interface AdminUser {
  id: string;
  displayName: string;
  handle: string;
  city: string;
  country: string;
  status: string;
  role: string;
  createdAt: string;
}

const STATUS_FR: Record<string, string> = {
  active: 'Actif',
  pending_review: 'En attente',
  suspended: 'Suspendu',
  rejected: 'Rejeté',
};
const STATUS_CLASS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  pending_review: 'bg-accent-soft text-accent',
  suspended: 'bg-rose-50 text-rose-600',
  rejected: 'bg-surface text-muted',
};
const ROLE_FR: Record<string, string> = {
  creator: 'Créateur',
  consultant: 'Consultant',
  business: 'Marque',
  super_admin: 'Admin',
};

const STATUS_FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'active', label: 'Actifs' },
  { id: 'pending_review', label: 'En attente' },
  { id: 'suspended', label: 'Suspendus' },
] as const;

const ROLE_FILTERS = [
  { id: 'all', label: 'Tous les rôles' },
  { id: 'creator', label: 'Créateurs' },
  { id: 'consultant', label: 'Consultants' },
  { id: 'business', label: 'Marques' },
] as const;

export function UsersTable({ users }: { users: AdminUser[] }) {
  const [status, setStatus] = useState<string>('all');
  const [role, setRole] = useState<string>('all');
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users.filter((u) => {
      if (status !== 'all' && u.status !== status) return false;
      if (role !== 'all' && u.role !== role) return false;
      if (needle && !`${u.displayName} ${u.handle}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [users, status, role, q]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un nom ou @identifiant"
            className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm text-ink placeholder-muted/60 focus:border-brand focus:outline-none"
          />
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {STATUS_FILTERS.map((f) => (
            <Chip key={f.id} active={status === f.id} onClick={() => setStatus(f.id)}>{f.label}</Chip>
          ))}
          <span className="w-px shrink-0 bg-line" />
          {ROLE_FILTERS.map((f) => (
            <Chip key={f.id} active={role === f.id} onClick={() => setRole(f.id)}>{f.label}</Chip>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted">{filtered.length} membre{filtered.length > 1 ? 's' : ''}</p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-10 text-center text-sm text-muted">
          Aucun membre ne correspond à ces filtres.
        </div>
      ) : (
        <ul className="grid gap-3">
          {filtered.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition ${
        active ? 'border-brand bg-brand text-white' : 'border-line bg-white text-muted hover:border-brand hover:text-brand'
      }`}
    >
      {children}
    </button>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const [state, action, pending] = useActionState<ModerateState, FormData>(moderateAction, { error: null });

  return (
    <li className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-bold text-ink">{user.displayName}</span>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700">
              {ROLE_FR[user.role] ?? user.role}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASS[user.status] ?? 'bg-surface text-muted'}`}>
              {STATUS_FR[user.status] ?? user.status}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
            <span>@{user.handle}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {user.city} · {user.country}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user.status === 'pending_review' && (
            <>
              <ActionButton action={action} target={user.id} status="rejected" pending={pending} variant="ghost" icon={X}>Rejeter</ActionButton>
              <ActionButton action={action} target={user.id} status="active" pending={pending} variant="primary" icon={Check}>Approuver</ActionButton>
            </>
          )}
          {user.status === 'active' && (
            <ActionButton action={action} target={user.id} status="suspended" pending={pending} variant="ghost" icon={Ban}>Suspendre</ActionButton>
          )}
          {(user.status === 'suspended' || user.status === 'rejected') && (
            <ActionButton action={action} target={user.id} status="active" pending={pending} variant="primary" icon={RotateCcw}>Réactiver</ActionButton>
          )}
        </div>
      </div>
      {state.error && <p className="mt-2 text-xs text-rose-600">{state.error}</p>}
    </li>
  );
}

function ActionButton({
  action,
  target,
  status,
  pending,
  variant,
  icon: Icon,
  children,
}: {
  action: (formData: FormData) => void;
  target: string;
  status: string;
  pending: boolean;
  variant: 'primary' | 'ghost';
  icon: typeof Check;
  children: React.ReactNode;
}) {
  const cls =
    variant === 'primary'
      ? 'bg-brand text-white hover:bg-brand-600'
      : 'border border-line text-muted hover:border-rose-200 hover:text-rose-600';
  return (
    <form action={action}>
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex min-h-tap items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition active:scale-95 disabled:opacity-50 ${cls}`}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />} {children}
      </button>
    </form>
  );
}
