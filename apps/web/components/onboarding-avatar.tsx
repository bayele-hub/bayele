'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2, AlertCircle } from 'lucide-react';
import { createClient } from '@bayele/database/client';
import { SmartAvatar } from '@/components/smart-avatar';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Extract the storage object path from a public avatar URL, so we can delete a superseded file.
function pathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const encoded = url.match(/\/storage\/v1\/object\/public\/avatars\/(.+)$/)?.[1];
  return encoded ? decodeURIComponent(encoded) : null;
}

/**
 * Onboarding photo picker. Unlike the in-app AvatarUploader, the profile row does NOT exist yet
 * here — so instead of persisting via an UPDATE, this uploads to the owner-scoped `avatars` bucket
 * (path "{userId}/…", allowed by storage RLS on auth.uid()) and writes the resulting public URL into
 * a hidden <input name="avatar_url">. onboard_profile then stores it (p_avatar_url) when the form is
 * submitted, so the photo lands on the profile at creation time.
 */
export function OnboardingAvatar({ userId, name }: { userId: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the user re-pick the same file after an error
    if (!file) return;
    setError(null);
    if (!TYPES.includes(file.type)) {
      setError('Formats acceptés : JPG, PNG, WebP ou GIF.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Image trop lourde (5 Mo maximum).');
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const key = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(key, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      const publicUrl = supabase.storage.from('avatars').getPublicUrl(key).data.publicUrl;

      // Best-effort cleanup if the user replaces a photo before submitting.
      const oldPath = pathFromUrl(url);
      if (oldPath) await supabase.storage.from('avatars').remove([oldPath]).catch(() => {});

      setUrl(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "L'envoi de la photo a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    setError(null);
    try {
      const oldPath = pathFromUrl(url);
      if (oldPath) {
        const supabase = createClient();
        await supabase.storage.from('avatars').remove([oldPath]).catch(() => {});
      }
      setUrl(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="text-xs font-semibold text-ink">Photo de profil (optionnel)</label>
      <div className="mt-1.5 flex items-center gap-4 rounded-2xl border border-line bg-surface p-3">
        <div className="relative shrink-0">
          <SmartAvatar src={url} name={name || 'Bayele'} className="h-16 w-16 text-base" />
          {busy && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-white/70">
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted">JPG, PNG, WebP ou GIF — 5 Mo max.</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-bold text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-50"
            >
              <Camera className="h-3.5 w-3.5" /> {url ? 'Changer' : 'Ajouter une photo'}
            </button>
            {url && (
              <button
                type="button"
                disabled={busy}
                onClick={onRemove}
                className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Retirer
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Submitted with the form; onboard_profile persists it as p_avatar_url. */}
      <input type="hidden" name="avatar_url" value={url ?? ''} />
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onPick} className="hidden" />
      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
