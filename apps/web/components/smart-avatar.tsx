'use client';
import { useState } from 'react';

/** Renders a photo when available; falls back to initials if missing or on load error. */
export function SmartAvatar({
  src, name, className, imgClassName,
}: {
  src?: string | null;
  name: string;
  className?: string;
  imgClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name.slice(0, 2).toUpperCase();
  const base = 'grid place-items-center overflow-hidden rounded-full bg-brand-50 font-bold text-brand-700';
  if (!src || failed) {
    return <div className={`${base} ${className ?? ''}`}>{initials}</div>;
  }
  return (
    <div className={`${base} ${className ?? ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={name} onError={() => setFailed(true)} className={imgClassName ?? 'h-full w-full object-cover'} />
    </div>
  );
}
