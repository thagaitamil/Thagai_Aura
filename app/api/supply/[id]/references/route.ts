import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/api/response";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { response } = await requireApiProfile();
  if (response) return response;

  const supabase = createClient();
  const { data: references, error: referencesError } = await supabase
    .from("supply_references")
    .select("*")
    .eq("supply_id", params.id)
    .order("created_at", { ascending: false });

  if (referencesError) {
    return NextResponse.json({ error: referencesError.message }, { status: 500 });
  }

  const referenceIds = (references ?? []).map((ref) => ref.id);
  const { data: referenceDocuments, error: docsError } = referenceIds.length
    ? await supabase
        .from("supply_reference_documents")
        .select("id, reference_id, doc_type, file_name, storage_path, created_at")
        .in("reference_id", referenceIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (docsError) return NextResponse.json({ error: docsError.message }, { status: 500 });
  return NextResponse.json({
    references: references ?? [],
    referenceDocuments: referenceDocuments ?? [],
  });
}
