import type { SupabaseClient } from "@supabase/supabase-js";

/** When manual override is off, Aadhaar + smart_card on profile → verified; else → pending. */
export async function recomputeSupplyVerificationFromDocuments(
  supabase: SupabaseClient,
  supplyId: string
) {
  const { data: profile } = await supabase
    .from("supply_profiles")
    .select("verification_manual_override")
    .eq("id", supplyId)
    .maybeSingle();
  if (!profile || profile.verification_manual_override) return;

  const { data: docs } = await supabase
    .from("supply_documents")
    .select("doc_type")
    .eq("supply_id", supplyId);
  const types = new Set((docs ?? []).map((d) => d.doc_type as string));
  const hasBoth = types.has("aadhaar") && types.has("smart_card");
  const next = hasBoth ? "verified" : "pending";
  await supabase.from("supply_profiles").update({ verification_status: next }).eq("id", supplyId);
}

export async function recomputeLeadVerificationFromDocuments(
  supabase: SupabaseClient,
  leadId: string
) {
  const { data: profile } = await supabase
    .from("leads")
    .select("verification_manual_override")
    .eq("id", leadId)
    .maybeSingle();
  if (!profile || profile.verification_manual_override) return;

  const { data: docs } = await supabase
    .from("lead_documents")
    .select("doc_type")
    .eq("lead_id", leadId);
  const types = new Set((docs ?? []).map((d) => d.doc_type as string));
  const hasBoth = types.has("aadhaar") && types.has("smart_card");
  const next = hasBoth ? "verified" : "pending";
  await supabase.from("leads").update({ verification_status: next }).eq("id", leadId);
}
