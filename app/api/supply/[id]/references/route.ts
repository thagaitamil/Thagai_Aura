import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/api/response";
import { CACHE_TTL_SECONDS, cached } from "@/lib/cache/redis";
import { cacheTags } from "@/lib/cache/tags";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { profile, response } = await requireApiProfile();
  if (response) return response;

  const payload = await cached({
    key: `api:${profile!.id}:supply:${params.id}:references`,
    tags: [cacheTags.supply(params.id)],
    ttlSeconds: CACHE_TTL_SECONDS,
    getFresh: async () => {
      const supabase = createClient();
      const { data: references, error: referencesError } = await supabase
        .from("supply_references")
        .select("*")
        .eq("supply_id", params.id)
        .order("created_at", { ascending: false });

      if (referencesError) throw referencesError;

      const referenceIds = (references ?? []).map((ref) => ref.id);
      const { data: referenceDocuments, error: docsError } = referenceIds.length
        ? await supabase
            .from("supply_reference_documents")
            .select("id, reference_id, doc_type, file_name, storage_path, created_at")
            .in("reference_id", referenceIds)
            .order("created_at", { ascending: false })
        : { data: [], error: null };

      if (docsError) throw docsError;
      return {
        references: references ?? [],
        referenceDocuments: referenceDocuments ?? [],
      };
    },
  });

  return NextResponse.json(payload);
}
