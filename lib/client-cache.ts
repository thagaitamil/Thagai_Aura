"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export function invalidateClientCache(prefix: string) {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function useCachedJson<T>(
  key: string,
  url: string,
  options: {
    enabled?: boolean;
    initialData: T;
    staleTime?: number;
  },
) {
  const { enabled = true, initialData, staleTime = 60_000 } = options;
  const [data, setData] = useState<T>(() => {
    const hit = cache.get(key) as CacheEntry<T> | undefined;
    return hit?.data ?? initialData;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const load = useCallback(async (force = false) => {
    if (!enabled) return data;
    const now = Date.now();
    const hit = cache.get(key) as CacheEntry<T> | undefined;
    if (!force && hit && hit.expiresAt > now) {
      setData(hit.data);
      return hit.data;
    }

    setLoading(true);
    setError(null);
    try {
      let request = inflight.get(key) as Promise<T> | undefined;
      if (!request || force) {
        request = fetch(url, { credentials: "include" }).then(async (response) => {
          if (!response.ok) throw new Error("Could not load data.");
          return (await response.json()) as T;
        });
        inflight.set(key, request);
      }

      const next = await request;
      cache.set(key, { data: next, expiresAt: Date.now() + staleTime });
      if (alive.current) setData(next);
      return next;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load data.";
      if (alive.current) setError(message);
      return data;
    } finally {
      inflight.delete(key);
      if (alive.current) setLoading(false);
    }
  }, [data, enabled, key, staleTime, url]);

  useEffect(() => {
    alive.current = true;
    if (enabled) void load(false);
    return () => {
      alive.current = false;
    };
  }, [enabled, load]);

  return { data, error, loading, reload: () => load(true), setData };
}
