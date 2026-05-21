import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getPublicSupabaseKey } from "@/lib/supabase/env-keys";
import { CACHE_TTL_SECONDS, cached } from "@/lib/cache/redis";
import { cacheTags } from "@/lib/cache/tags";

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  let publicKey: string;
  try {
    publicKey = getPublicSupabaseKey();
  } catch {
    return NextResponse.json({ areas: [] }, { status: 503 });
  }
  if (!url) return NextResponse.json({ areas: [] }, { status: 503 });

  const cookieStore = cookies();
  const supabase = createServerClient(url, publicKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* ignore */
        }
      },
    },
  });

  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const payload = await cached({
    key: `areas:search:${q.toLowerCase()}`,
    tags: [cacheTags.areas],
    ttlSeconds: CACHE_TTL_SECONDS,
    getFresh: async () => {
      let query = supabase
        .from("area_options")
        .select("id, label")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true })
        .limit(50);
      if (q.length >= 1) {
        query = query.ilike("label", `%${q.replace(/[%_]/g, "")}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return { areas: data ?? [] };
    },
  });
  return NextResponse.json(payload);
}
