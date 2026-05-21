import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/api/response";
import { CACHE_TTL_SECONDS, cached } from "@/lib/cache/redis";
import { cacheTags } from "@/lib/cache/tags";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { profile, response } = await requireApiProfile();
  if (response) return response;

  const payload = await cached({
    key: `api:${profile!.id}:lead:${params.id}:activities`,
    tags: [cacheTags.lead(params.id)],
    ttlSeconds: CACHE_TTL_SECONDS,
    getFresh: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", params.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return { activities: data ?? [] };
    },
  });

  return NextResponse.json(payload);
}
