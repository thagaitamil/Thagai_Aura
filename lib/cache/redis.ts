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

function cacheKey(key: string) {
  return namespaced(`cache:${key}`);
}

function tagKeysKey(tag: string) {
  return namespaced(`tag:${tag}:keys`);
}

export async function cached<T>({ key, ttlSeconds, tags = [], getFresh }: CacheOptions<T>): Promise<T> {
  const keyName = cacheKey(key);
  const client = getRedis();

  if (!client) {
    return getFresh();
  }

  const hit = await client.get<T>(keyName).catch(() => null);
  if (hit !== null) return hit;

  const fresh = await getFresh();
  await client.set(keyName, fresh, { ex: ttlSeconds }).catch(() => undefined);
  if (tags.length) {
    await Promise.all(
      Array.from(new Set(tags)).map(async (tag) => {
        const setKey = tagKeysKey(tag);
        await client.sadd(setKey, keyName).catch(() => undefined);
        await client.expire(setKey, Math.max(ttlSeconds, CACHE_TTL_SECONDS) + 60).catch(() => undefined);
      }),
    );
  }
  return fresh;
}

export async function invalidateCacheTags(tags: string[]) {
  if (!tags.length) return;
  const client = getRedis();
  if (!client) return;

  const uniqueTags = Array.from(new Set(tags));
  const keySets = await Promise.all(
    uniqueTags.map((tag) => client.smembers<string[]>(tagKeysKey(tag)).catch(() => [])),
  );
  const keys = Array.from(new Set(keySets.flat()));
  if (keys.length) {
    await Promise.all(
      chunk(keys, 100).map((batch) => client.del(...batch).catch(() => undefined)),
    );
  }
  await Promise.all(uniqueTags.map((tag) => client.del(tagKeysKey(tag)).catch(() => undefined)));
}

export function redisCacheEnabled() {
  return !!getRedis();
}

function chunk<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}
