import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getPublicSupabaseKey } from "@/lib/supabase/env-keys";
import { parseSupplySearchToken } from "@/lib/display-ids";
import { CACHE_TTL_SECONDS, cached } from "@/lib/cache/redis";
import { cacheTags } from "@/lib/cache/tags";

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  let publicKey: string;
  try {
    publicKey = getPublicSupabaseKey();
  } catch {
    return NextResponse.json({ rows: [] }, { status: 503 });
  }
  if (!url) return NextResponse.json({ rows: [] }, { status: 503 });

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
  const userId = claimsData?.claims.sub;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ rows: [] });

  const payload = await cached({
    key: `supply:picker:${userId}:${q.toLowerCase()}`,
    tags: [cacheTags.supplyList],
    ttlSeconds: CACHE_TTL_SECONDS,
    getFresh: async () => {
      const num = parseSupplySearchToken(q);

      if (num != null) {
        const { data } = await supabase
          .from("supply_profiles")
          .select("id, full_name, supply_number")
          .is("deleted_at", null)
          .eq("supply_number", num)
          .limit(10);
        if (data?.length) {
          return { rows: data };
        }
      }

      const pat = `%${q.replace(/[%_\\]/g, "")}%`;
      const { data } = await supabase
        .from("supply_profiles")
        .select("id, full_name, supply_number")
        .is("deleted_at", null)
        .ilike("full_name", pat)
        .order("full_name", { ascending: true })
        .limit(20);

      return { rows: data ?? [] };
    },
  });

  return NextResponse.json(payload);
}
