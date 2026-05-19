import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/api/response";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { response } = await requireApiProfile();
  if (response) return response;

  const supabase = createClient();
  const [{ data: mappings, error: mappingsError }, { data: supplies, error: suppliesError }] =
    await Promise.all([
      supabase
        .from("supply_mapping")
        .select("*, supply_profiles(full_name, status, type, supply_number)")
        .eq("lead_id", params.id)
        .order("priority", { ascending: true }),
      supabase
        .from("supply_profiles")
        .select("id, full_name, type, status")
        .is("deleted_at", null)
        .order("full_name", { ascending: true })
        .limit(500),
    ]);

  const error = mappingsError ?? suppliesError;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mappings: mappings ?? [], supplies: supplies ?? [] });
}
