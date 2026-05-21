import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/api/response";
import { CACHE_TTL_SECONDS, cached } from "@/lib/cache/redis";
import { cacheTags } from "@/lib/cache/tags";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { profile, response } = await requireApiProfile();
  if (response) return response;

  const payload = await cached({
    key: `api:${profile!.id}:supply:${params.id}:assigned-leads`,
    tags: [cacheTags.supply(params.id), cacheTags.leads],
    ttlSeconds: CACHE_TTL_SECONDS,
    getFresh: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("supply_mapping")
        .select("lead_id, priority, trial_status, leads(id, name, phone, status, trail_number)")
        .eq("supply_id", params.id)
        .order("priority", { ascending: true });

      if (error) throw error;

      const assignedLeads = (data ?? [])
        .map((row) => {
          const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
          if (!lead) return null;
          return {
            lead_id: lead.id,
            name: lead.name,
            phone: lead.phone,
            status: lead.status,
            trail_number: lead.trail_number,
            priority: row.priority,
            trial_status: row.trial_status,
          };
        })
        .filter(Boolean);

      return { assignedLeads };
    },
  });

  return NextResponse.json(payload);
}
