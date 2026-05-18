import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getPublicSupabaseKey } from "@/lib/supabase/env-keys";

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
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch { /* ignore when read-only */ }
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pat = ilikePattern(request.nextUrl.searchParams.get("q") ?? "");
  if (!pat) return NextResponse.json({ leads: [], supply: [] });

  const [
    leadByName,
    leadByPhone,
    leadByArea,
    supplyByName,
    supplyByPhone,
    supplyByArea,
    supplyByRef,
  ] = await Promise.all([
    // Leads: by name
    supabase.from("leads").select("id, name, phone, area_free_text")
      .is("deleted_at", null).ilike("name", pat).limit(8),
    // Leads: by phone
    supabase.from("leads").select("id, name, phone, area_free_text")
      .is("deleted_at", null).ilike("phone", pat).limit(8),
    // Leads: by area free text
    supabase.from("leads").select("id, name, phone, area_free_text")
      .is("deleted_at", null).ilike("area_free_text", pat).limit(8),
    // Supply: by name
    supabase.from("supply_profiles").select("id, full_name, phone, area_free_text")
      .is("deleted_at", null).ilike("full_name", pat).limit(8),
    // Supply: by phone
    supabase.from("supply_profiles").select("id, full_name, phone, area_free_text")
      .is("deleted_at", null).ilike("phone", pat).limit(8),
    // Supply: by area free text
    supabase.from("supply_profiles").select("id, full_name, phone, area_free_text")
      .is("deleted_at", null).ilike("area_free_text", pat).limit(8),
    // Supply: by reference person name
    supabase.from("supply_references").select("supply_id, ref_name")
      .ilike("ref_name", pat).limit(8),
  ]);

  // Merge lead results
  const leadMap = new Map<string, { id: string; name: string; phone: string; sub?: string }>();
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

  // Merge supply results (include those found via reference)
  const supplyMap = new Map<string, { id: string; full_name: string; phone: string; sub?: string }>();
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

  // For reference hits, look up the supply profile
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

  return NextResponse.json({
    leads: Array.from(leadMap.values()).slice(0, 10),
    supply: Array.from(supplyMap.values()).slice(0, 10),
  });
}
