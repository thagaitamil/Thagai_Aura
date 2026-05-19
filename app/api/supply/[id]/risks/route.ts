import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/api/response";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { response } = await requireApiProfile();
  if (response) return response;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("supply_risk_markers")
    .select("*")
    .eq("supply_id", params.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ risks: data ?? [] });
}
