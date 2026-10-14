// G8 / §5.3 (low priority, P6): client pipeline for WhatsApp proof screenshots.
// decode → canvas (longest side ≤ 1600 px) → WebP (JPEG fallback), stepping quality down until ≈ 300 KB
// → refuse > 5 MB → SHA-256 of the final bytes → upload to proofs/{creator}/{cc}/{uuid}.{ext}.
export const TARGET_BYTES = 300 * 1024;
export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_SIDE = 1600;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52, 0.42, 0.34] as const;

export type Encoder = (quality: number) => Promise<Blob | null>;

export function isAcceptedType(type: string): boolean {
  return (ACCEPTED_TYPES as readonly string[]).includes(type);
}

/** Scale (w, h) so the longest side is at most `max`, keeping the ratio (never upscales). */
export function fitWithin(w: number, h: number, max = MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(w, h);
  if (longest <= max) return { width: w, height: h };
  const k = max / longest;
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

/**
 * Encode with decreasing quality until the result is ≤ TARGET_BYTES; keep the smallest result.
 * Returns null when nothing could be encoded, and flags `tooLarge` when even the best is > 5 MB.
 */
export async function compressToTarget(encode: Encoder, target = TARGET_BYTES): Promise<{ blob: Blob; quality: number; tooLarge: boolean } | null> {
  let best: { blob: Blob; quality: number } | null = null;
  for (const q of QUALITY_STEPS) {
    const blob = await encode(q);
    if (!blob) continue;
    if (!best || blob.size < best.blob.size) best = { blob, quality: q };
    if (blob.size <= target) break;
  }
  if (!best) return null;
  return { ...best, tooLarge: best.blob.size > MAX_BYTES };
}

/** Lower-case hex SHA-256 of the bytes (Web Crypto, also available in Node 20+). */
export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await crypto.subtle.digest('SHA-256', buf as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function extFor(type: string): 'webp' | 'jpg' | 'png' {
  return type === 'image/webp' ? 'webp' : type === 'image/png' ? 'png' : 'jpg';
}

/** Contract §8 path: {creator_id}/{campaign_creator_id}/{name}.{ext}, name = 1–64 of [A-Za-z0-9_-]. */
export function proofPath(creatorId: string, ccId: string, name: string, ext: string): string {
  const safe = name.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'shot';
  return `${creatorId}/${ccId}/${safe}.${ext}`;
}

/** Retry an async step up to `retries` extra times (2 automatic retries by default). */
export async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let last: unknown;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); } catch (e) { last = e; }
  }
  throw last;
}

/** Browser-only: decode a File into a canvas sized by fitWithin and compress it. */
export async function compressImageFile(file: File): Promise<{ blob: Blob; type: string; tooLarge: boolean } | null> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const enc = (type: string): Encoder => (q) => new Promise((res) => canvas.toBlob((b) => res(b && b.type === type ? b : null), type, q));
  let out = await compressToTarget(enc('image/webp'));
  let type = 'image/webp';
  if (!out) { out = await compressToTarget(enc('image/jpeg')); type = 'image/jpeg'; }
  return out ? { blob: out.blob, type, tooLarge: out.tooLarge } : null;
}
