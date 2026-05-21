import "server-only";

import { Redis } from "@upstash/redis";

type CacheOptions<T> = {
  key: string;
  ttlSeconds: number;
  tags?: string[];
  getFresh: () => Promise<T>;
};

const appPrefix = process.env.REDIS_CACHE_PREFIX ?? "aura";
const memoryCache = new Map<string, { expiresAt: number; value: unknown }>();

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
  if (!client) return String(memoryGet<number>(key) ?? 0);
  const value = await client.get<number>(key).catch(() => null);
  return String(value ?? 0);
}

async function buildVersionedKey(key: string, tags: string[] = []) {
  if (!tags.length) return namespaced(`cache:${key}`);
  const versions = await Promise.all(tags.map(async (tag) => `${tag}:${await getTagVersion(tag)}`));
  return namespaced(`cache:${key}:${versions.join("|")}`);
}

export async function cached<T>({ key, ttlSeconds, tags = [], getFresh }: CacheOptions<T>): Promise<T> {
  const cacheKey = await buildVersionedKey(key, tags);
  const client = getRedis();

  if (!client) {
    const hit = memoryGet<T>(cacheKey);
    if (hit !== null) return hit;
    const fresh = await getFresh();
    memorySet(cacheKey, fresh, ttlSeconds);
    return fresh;
  }

  const hit = await client.get<T>(cacheKey).catch(() => null);
  if (hit !== null) return hit;

  const fresh = await getFresh();
  await client.set(cacheKey, fresh, { ex: ttlSeconds }).catch(() => undefined);
  return fresh;
}

export async function invalidateCacheTags(tags: string[]) {
  if (!tags.length) return;
  const client = getRedis();
  if (!client) {
    for (const tag of tags) {
      const key = namespaced(`tag:${tag}:v`);
      memorySet(key, (memoryGet<number>(key) ?? 0) + 1, 60 * 60 * 24);
    }
    return;
  }

  await Promise.all(
    tags.map((tag) => client.incr(namespaced(`tag:${tag}:v`)).catch(() => undefined)),
  );
}

export function redisCacheEnabled() {
  return !!getRedis();
}
