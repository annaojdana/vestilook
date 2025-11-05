import { supabaseClient } from "@/db/supabase.client.ts";

interface SignedUrlCacheEntry {
  url: string;
  expiresAt: number;
}

interface SignedUrlOptions {
  expiresIn?: number;
  cacheTtlMs?: number;
  forceRefresh?: boolean;
}

const DEFAULT_EXPIRES_IN_SECONDS = 60;
const DEFAULT_CACHE_TTL_MS = 60_000;
const cache = new Map<string, SignedUrlCacheEntry>();

export async function getSignedAssetUrl(
  bucket: string | null | undefined,
  path: string | null | undefined,
  options: SignedUrlOptions = {},
): Promise<string | null> {
  if (!bucket || !path) {
    return null;
  }

  const key = `${bucket}:${path}`;
  const now = Date.now();
  const cacheTtl = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const cached = cache.get(key);

  if (cached && cached.expiresAt > now && !options.forceRefresh) {
    return cached.url;
  }

  const expiresIn = normalizeExpiresIn(options.expiresIn);

  const { data, error } = await supabaseClient.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    cache.delete(key);
    console.warn("Nie udało się wygenerować podpisanego adresu URL.", {
      bucket,
      path,
      error: error?.message ?? "unknown_error",
    });
    return null;
  }

  const signedUrl = data.signedUrl;
  cache.set(key, {
    url: signedUrl,
    expiresAt: now + cacheTtl,
  });

  return signedUrl;
}

export function invalidateSignedAssetUrl(bucket: string, path: string): void {
  cache.delete(`${bucket}:${path}`);
}

export function clearSignedAssetCache(): void {
  cache.clear();
}

function normalizeExpiresIn(expiresIn: number | undefined): number {
  if (!Number.isFinite(expiresIn) || !expiresIn) {
    return DEFAULT_EXPIRES_IN_SECONDS;
  }

  if (expiresIn < 1) {
    return 1;
  }

  return Math.floor(expiresIn);
}

