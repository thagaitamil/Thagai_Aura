import "server-only";

import { Redis } from "@upstash/redis";

type CacheOptions<T> = {
  key: string;
  ttlSeconds: number;
  tags?: string[];
  getFresh: () => Promise<T>;
};

export const CACHE_TTL_SECONDS = 60 * 60;

const appPrefix = process.env.REDIS_CACHE_PREFIX ?? "aura";
const memoryCache = new Map<string, { expiresAt: number; value: unknown }>();
const memoryTagVersions = new Map<string, number>();

let redis: Redis | null | undefined;

function getRedis() {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redis = null;
    return redis;
  }
  redis = new Redis({ url, token });
  return redis;
}

function namespaced(key: string) {
  return `${appPrefix}:${key}`;
}

function memoryGet<T>(key: string) {
  const hit = memoryCache.get(key);
  if (!hit || hit.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return hit.value as T;
}

function memorySet<T>(key: string, value: T, ttlSeconds: number) {
  memoryCache.set(key, {
    expiresAt: Date.now() + ttlSeconds * 1000,
    value,
  });
}

async function getTagVersion(tag: string) {
  const client = getRedis();
  const key = namespaced(`tag:${tag}:v`);
  const localVersion = memoryTagVersions.get(key);
  if (localVersion !== undefined) return String(localVersion);
  if (!client) return String(memoryGet<number>(key) ?? 0);
  const value = await client.get<number>(key).catch(() => null);
  const version = value ?? 0;
  memoryTagVersions.set(key, version);
  return String(version);
}

async function buildVersionedKey(key: string, tags: string[] = []) {
  if (!tags.length) return namespaced(`cache:${key}`);
  const versions = await Promise.all(tags.map(async (tag) => `${tag}:${await getTagVersion(tag)}`));
  return namespaced(`cache:${key}:${versions.join("|")}`);
}

export async function cached<T>({ key, ttlSeconds, tags = [], getFresh }: CacheOptions<T>): Promise<T> {
  const cacheKey = await buildVersionedKey(key, tags);
  const localHit = memoryGet<T>(cacheKey);
  if (localHit !== null) return localHit;

  const client = getRedis();

  if (!client) {
    const fresh = await getFresh();
    memorySet(cacheKey, fresh, ttlSeconds);
    return fresh;
  }

  const hit = await client.get<T>(cacheKey).catch(() => null);
  if (hit !== null) {
    memorySet(cacheKey, hit, ttlSeconds);
    return hit;
  }

  const fresh = await getFresh();
  memorySet(cacheKey, fresh, ttlSeconds);
  await client.set(cacheKey, fresh, { ex: ttlSeconds }).catch(() => undefined);
  return fresh;
}

export async function invalidateCacheTags(tags: string[]) {
  if (!tags.length) return;
  const client = getRedis();
  if (!client) {
    for (const tag of tags) {
      const key = namespaced(`tag:${tag}:v`);
      const next = (memoryGet<number>(key) ?? memoryTagVersions.get(key) ?? 0) + 1;
      memorySet(key, next, 60 * 60 * 24);
      memoryTagVersions.set(key, next);
    }
    return;
  }

  await Promise.all(
    tags.map(async (tag) => {
      const key = namespaced(`tag:${tag}:v`);
      const next = await client.incr(key).catch(() => null);
      if (next != null) memoryTagVersions.set(key, next);
    }),
  );
}

export function redisCacheEnabled() {
  return !!getRedis();
}
