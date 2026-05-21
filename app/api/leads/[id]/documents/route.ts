import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/api/response";
import { cached } from "@/lib/cache/redis";
import { cacheTags } from "@/lib/cache/tags";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { profile, response } = await requireApiProfile();
  if (response) return response;

  const payload = await cached({
    key: `api:${profile!.id}:lead:${params.id}:documents`,
    tags: [cacheTags.lead(params.id)],
    ttlSeconds: 60,
    getFresh: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("lead_documents")
        .select("*")
        .eq("lead_id", params.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return { documents: data ?? [] };
    },
  });

  return NextResponse.json(payload);
}
