import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/api/response";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { response } = await requireApiProfile();
  if (response) return response;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("lead_follow_ups")
    .select("id, due_at, notes, outcome, completed_at, created_at")
    .eq("lead_id", params.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ followUps: data ?? [] });
}
