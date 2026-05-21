import "server-only";

import { Redis } from "@upstash/redis";

type CacheOptions<T> = {
  key: string;
  ttlSeconds: number;
  tags?: string[];
  getFresh: () => Promise<T>;
};

export const CACHE_TTL_SECONDS = 30 * 60;

const appPrefix = process.env.REDIS_CACHE_PREFIX ?? "aura";

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

async function buildVersionedKey(key: string, tags: string[] = []) {
  if (!tags.length) return namespaced(`cache:${key}`);
  const client = getRedis();
  const tagKeys = tags.map((tag) => namespaced(`tag:${tag}:v`));
  const values = client
    ? await client.mget<(number | null)[]>(...tagKeys).catch(() => [])
    : [];
  const versions = tags.map((tag, index) => `${tag}:${values[index] ?? 0}`);
  return namespaced(`cache:${key}:${versions.join("|")}`);
}

export async function cached<T>({ key, ttlSeconds, tags = [], getFresh }: CacheOptions<T>): Promise<T> {
  const cacheKey = await buildVersionedKey(key, tags);
  const client = getRedis();

  if (!client) {
    return getFresh();
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
  if (!client) return;

  await Promise.all(
    tags.map((tag) => client.incr(namespaced(`tag:${tag}:v`)).catch(() => undefined)),
  );
}

export function redisCacheEnabled() {
  return !!getRedis();
}
