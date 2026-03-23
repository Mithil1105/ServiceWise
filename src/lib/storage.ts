/**
 * Centralized storage abstraction. Uses Cloudflare R2 via Edge Function when configured.
 * All operations are authenticated; R2 credentials never touch the client.
 */
import { invokeAuthed } from '@/lib/functions-invoke';
import type { InvokeAuthedOptions } from '@/lib/functions-invoke';
import { supabase } from '@/integrations/supabase/client';
import { isFullUrl, isR2PrefixedKey, stripBucketPrefix, type StorageBucket } from '@/lib/storage-keys';

const STORAGE_FN = 'storage-r2';

/** Domains map to R2 key prefixes (see storage-keys.ts). */
export type StorageDomain =
  | 'organization-logos'
  | 'bills'
  | 'driver-licenses'
  | 'car-documents'
  | 'service-bills';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64 ?? '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export interface StorageUploadResult {
  key: string;
}

function debugFallback(message: string, meta: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.debug(`[storage-fallback] ${message}`, meta);
  }
}

/**
 * Upload a file to R2. Key must be the full object key (including prefix).
 */
export async function storageUpload(
  key: string,
  file: File,
  options?: InvokeAuthedOptions
): Promise<StorageUploadResult> {
  const content = await fileToBase64(file);
  const res = await invokeAuthed<{ key?: string; error?: string }>(
    STORAGE_FN,
    {
      action: 'upload',
      key,
      content,
      contentType: file.type || 'application/octet-stream',
    },
    options
  );
  if (res?.error) throw new Error(res.error);
  return { key: res?.key ?? key };
}

/**
 * Delete objects by key. Keys are full object keys.
 */
export async function storageRemove(
  keys: string[],
  options?: InvokeAuthedOptions
): Promise<void> {
  if (keys.length === 0) return;
  const res = await invokeAuthed<{ error?: string }>(
    STORAGE_FN,
    { action: 'delete', keys },
    options
  );
  if (res?.error) throw new Error(res.error);
}

/**
 * Get a signed GET URL for private file access.
 */
export async function storageGetSignedUrl(
  pathOrKey: string,
  expiresInSeconds: number = 3600,
  options?: InvokeAuthedOptions,
  bucketType?: StorageBucket
): Promise<string> {
  if (!pathOrKey) throw new Error('Path is required');
  if (isFullUrl(pathOrKey)) return pathOrKey;

  const trySupabaseFallback = async (candidate: string): Promise<string> => {
    if (!bucketType) {
      throw new Error(`Legacy fallback requires bucketType for path: ${candidate}`);
    }

    const direct = await supabase.storage.from(bucketType).createSignedUrl(candidate, expiresInSeconds);
    if (!direct.error && direct.data?.signedUrl) {
      debugFallback('Resolved via Supabase signed URL', { bucketType, path: candidate });
      return direct.data.signedUrl;
    }

    const stripped = stripBucketPrefix(bucketType, candidate);
    if (stripped !== candidate) {
      const strippedRes = await supabase.storage.from(bucketType).createSignedUrl(stripped, expiresInSeconds);
      if (!strippedRes.error && strippedRes.data?.signedUrl) {
        debugFallback('Resolved via Supabase signed URL (stripped bucket prefix)', { bucketType, path: stripped });
        return strippedRes.data.signedUrl;
      }
    }

    throw direct.error ?? new Error(`No signed URL found for ${candidate}`);
  };

  if (!isR2PrefixedKey(pathOrKey)) {
    return trySupabaseFallback(pathOrKey);
  }

  try {
    const res = await invokeAuthed<{ url?: string; error?: string }>(
      STORAGE_FN,
      { action: 'signedUrl', key: pathOrKey, expiresIn: expiresInSeconds },
      options
    );
    if (res?.error) throw new Error(res.error);
    const url = res?.url;
    if (!url) throw new Error('No signed URL returned');
    return url;
  } catch (error) {
    if (!bucketType) throw error;
    debugFallback('R2 signed URL failed; trying Supabase fallback', {
      bucketType,
      path: pathOrKey,
      reason: error instanceof Error ? error.message : String(error),
    });
    return trySupabaseFallback(pathOrKey);
  }
}

/** Public base URL for assets (e.g. logos). Set via VITE_R2_PUBLIC_BASE_URL; no secrets. */
const PUBLIC_BASE = typeof import.meta !== 'undefined' && import.meta.env?.VITE_R2_PUBLIC_BASE_URL
  ? (import.meta.env.VITE_R2_PUBLIC_BASE_URL as string).replace(/\/$/, '')
  : '';

/**
 * Get public URL for a key, or signed URL fallback when public base is not set.
 * Use for organization logos only; private files should use storageGetSignedUrl.
 */
export async function storageGetPublicUrl(
  pathOrKey: string,
  signedUrlFallbackExpiresSeconds: number = 86400,
  options?: InvokeAuthedOptions,
  bucketType: StorageBucket = 'organization-logos'
): Promise<string> {
  if (!pathOrKey) throw new Error('Path is required');
  if (isFullUrl(pathOrKey)) return pathOrKey;

  if (isR2PrefixedKey(pathOrKey)) {
    if (PUBLIC_BASE) return `${PUBLIC_BASE}/${pathOrKey.replace(/^\//, '')}`;
    try {
      return await storageGetSignedUrl(pathOrKey, signedUrlFallbackExpiresSeconds, options, bucketType);
    } catch (error) {
      debugFallback('R2 public resolution failed; trying Supabase public URL fallback', {
        bucketType,
        path: pathOrKey,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const direct = supabase.storage.from(bucketType).getPublicUrl(pathOrKey).data.publicUrl;
  if (direct) {
    debugFallback('Resolved via Supabase public URL', { bucketType, path: pathOrKey });
    return direct;
  }

  const stripped = stripBucketPrefix(bucketType, pathOrKey);
  return supabase.storage.from(bucketType).getPublicUrl(stripped).data.publicUrl;
}
