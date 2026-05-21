import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getPublicSupabaseKey } from "@/lib/supabase/env-keys";
import {
  formatSupplyDisplayId,
  formatTrailId,
  parseSupplySearchToken,
  parseTrailSearchToken,
} from "@/lib/display-ids";
import { cached } from "@/lib/cache/redis";
import { cacheTags } from "@/lib/cache/tags";

function ilikePattern(q: string) {
  const cleaned = q.trim().replace(/[%_\\]/g, "");
  if (cleaned.length < 2) return null;
  return `%${cleaned}%`;
}

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  let publicKey: string;
  try {
    publicKey = getPublicSupabaseKey();
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }
  if (!url) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }

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
          /* ignore when read-only */
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const qRaw = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const pat = ilikePattern(qRaw);
  const trailNum = parseTrailSearchToken(qRaw);
  const supplyNum = parseSupplySearchToken(qRaw);

  if (!pat && trailNum == null && supplyNum == null) {
    return NextResponse.json({ leads: [], supply: [] });
  }

  const payload = await cached({
    key: `global-search:${user.id}:${qRaw.toLowerCase()}`,
    tags: [cacheTags.search, cacheTags.leads, cacheTags.supplyList],
    ttlSeconds: 45,
    getFresh: async () => {
      const leadMap = new Map<string, { id: string; name: string; phone: string; sub?: string }>();
      const supplyMap = new Map<string, { id: string; full_name: string; phone: string; sub?: string }>();

      if (trailNum != null) {
        const { data } = await supabase
          .from("leads")
          .select("id, name, phone, area_free_text, trail_number")
          .is("deleted_at", null)
          .eq("trail_number", trailNum)
          .limit(10);
        for (const row of data ?? []) {
          leadMap.set(row.id, {
            id: row.id,
            name: row.name,
            phone: String(row.phone),
            sub: formatTrailId(row.trail_number as number | null),
          });
        }
      }

      if (supplyNum != null) {
        const { data } = await supabase
          .from("supply_profiles")
          .select("id, full_name, phone, area_free_text, supply_number")
          .is("deleted_at", null)
          .eq("supply_number", supplyNum)
          .limit(10);
        for (const row of data ?? []) {
          supplyMap.set(row.id, {
            id: row.id,
            full_name: row.full_name,
            phone: String(row.phone),
            sub: formatSupplyDisplayId(row.supply_number as number | null),
          });
        }
      }

      if (pat) {
        const [
          leadByName,
          leadByPhone,
          leadByArea,
          supplyByName,
          supplyByPhone,
          supplyByArea,
          supplyByRef,
        ] = await Promise.all([
          supabase
            .from("leads")
            .select("id, name, phone, area_free_text")
            .is("deleted_at", null)
            .ilike("name", pat)
            .limit(8),
          supabase
            .from("leads")
            .select("id, name, phone, area_free_text")
            .is("deleted_at", null)
            .ilike("phone", pat)
            .limit(8),
          supabase
            .from("leads")
            .select("id, name, phone, area_free_text")
            .is("deleted_at", null)
            .ilike("area_free_text", pat)
            .limit(8),
          supabase
            .from("supply_profiles")
            .select("id, full_name, phone, area_free_text")
            .is("deleted_at", null)
            .ilike("full_name", pat)
            .limit(8),
          supabase
            .from("supply_profiles")
            .select("id, full_name, phone, area_free_text")
            .is("deleted_at", null)
            .ilike("phone", pat)
            .limit(8),
          supabase
            .from("supply_profiles")
            .select("id, full_name, phone, area_free_text")
            .is("deleted_at", null)
            .ilike("area_free_text", pat)
            .limit(8),
          supabase.from("supply_references").select("supply_id, ref_name").ilike("ref_name", pat).limit(8),
        ]);

        for (const row of [
          ...(leadByName.data ?? []),
          ...(leadByPhone.data ?? []),
          ...(leadByArea.data ?? []),
        ]) {
          if (!leadMap.has(row.id)) {
            leadMap.set(row.id, {
              id: row.id,
              name: row.name,
              phone: String(row.phone),
              sub: row.area_free_text ? String(row.area_free_text) : undefined,
            });
          }
        }

        for (const row of [
          ...(supplyByName.data ?? []),
          ...(supplyByPhone.data ?? []),
          ...(supplyByArea.data ?? []),
        ]) {
          if (!supplyMap.has(row.id)) {
            supplyMap.set(row.id, {
              id: row.id,
              full_name: row.full_name,
              phone: String(row.phone),
              sub: row.area_free_text ? String(row.area_free_text) : undefined,
            });
          }
        }

        const refSupplyIds = Array.from(
          new Set((supplyByRef.data ?? []).map((r) => r.supply_id as string))
        ).filter((id) => !supplyMap.has(id));

        if (refSupplyIds.length > 0) {
          const { data: refProfiles } = await supabase
            .from("supply_profiles")
            .select("id, full_name, phone, area_free_text")
            .in("id", refSupplyIds)
            .is("deleted_at", null);
          for (const row of refProfiles ?? []) {
            const refName = (supplyByRef.data ?? []).find((r) => r.supply_id === row.id)?.ref_name;
            supplyMap.set(row.id, {
              id: row.id,
              full_name: row.full_name,
              phone: String(row.phone),
              sub: refName ? `Ref: ${String(refName)}` : undefined,
            });
          }
        }
      }

      return {
        leads: Array.from(leadMap.values()).slice(0, 10),
        supply: Array.from(supplyMap.values()).slice(0, 10),
      };
    },
  });

  return NextResponse.json(payload);
}
