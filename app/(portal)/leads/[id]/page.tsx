import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, canWriteLeads } from "@/lib/auth/session";
import { LeadForm } from "@/components/leads/lead-form";
import { formatSupplyDisplayId } from "@/lib/display-ids";
import { LeadDetailTabs, type LeadSupplyMappingRow } from "@/components/leads/lead-detail-tabs";
import { CACHE_TTL_SECONDS, cached } from "@/lib/cache/redis";
import { cacheTags } from "@/lib/cache/tags";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createClient();
  const { profile } = await getSessionProfile();
  const [row, tagRows, areas, staff, assignment, mappings] = await Promise.all([
    cached({
      key: `lead-detail:${id}:profile`,
      tags: [cacheTags.leads, cacheTags.lead(id)],
      ttlSeconds: CACHE_TTL_SECONDS,
      getFresh: async () => {
        const { data } = await supabase
          .from("leads")
          .select("*")
          .eq("id", id)
          .is("deleted_at", null)
          .maybeSingle();
        return data;
      },
    }),
    cached({
      key: `lead-detail:${id}:areas`,
      tags: [cacheTags.areas, cacheTags.leads, cacheTags.lead(id)],
      ttlSeconds: CACHE_TTL_SECONDS,
      getFresh: async () => {
        const { data } = await supabase
          .from("lead_area_tags")
          .select("area_option_id")
          .eq("lead_id", id);
        return data ?? [];
      },
    }),
    cached({
      key: "areas:active:sorted",
      tags: [cacheTags.areas],
      ttlSeconds: CACHE_TTL_SECONDS,
      getFresh: async () => {
        const { data } = await supabase
          .from("area_options")
          .select("id, label")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });
        return data ?? [];
      },
    }),
    cached({
      key: "profiles:active:sorted",
      tags: [cacheTags.profiles],
      ttlSeconds: CACHE_TTL_SECONDS,
      getFresh: async () => {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("active", true)
          .order("full_name", { ascending: true });
        return data ?? [];
      },
    }),
    cached({
      key: `lead-detail:${id}:assignment`,
      tags: [cacheTags.profiles, cacheTags.leads, cacheTags.lead(id)],
      ttlSeconds: CACHE_TTL_SECONDS,
      getFresh: async () => {
        const { data } = await supabase
          .from("lead_assignments")
          .select("assigned_to")
          .eq("lead_id", id)
          .maybeSingle();
        return data;
      },
    }),
    cached({
      key: `lead-detail:${id}:mappings`,
      tags: [cacheTags.leads, cacheTags.lead(id), cacheTags.supplyList],
      ttlSeconds: CACHE_TTL_SECONDS,
      getFresh: async () => {
        const { data } = await supabase
          .from("supply_mapping")
          .select("*, supply_profiles(full_name, status, type, supply_number)")
          .eq("lead_id", id)
          .order("priority", { ascending: true });
        return data ?? [];
      },
    }),
  ]);

  if (!row) notFound();

  const canWrite = profile && canWriteLeads(profile.role);
  const initial = {
    ...row,
    area_option_ids: tagRows.map((t) => t.area_option_id),
  };

  const primaryMapping = mappings.find((m) => m.priority === 1);
  const convertedSupplyId = primaryMapping?.supply_id ?? null;
  let convertedSupplyLabel: string | null = null;
  if (convertedSupplyId) {
    const sp = primaryMapping?.supply_profiles as
      | { full_name?: string | null; supply_number?: number | null }
      | null
      | undefined;
    const name = sp?.full_name ?? null;
    const num = sp?.supply_number;
    if (name && num != null) {
      convertedSupplyLabel = `${name} (${formatSupplyDisplayId(num)})`;
    } else if (name) {
      convertedSupplyLabel = name;
    }
  }

  if (!canWrite) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-2xl font-semibold">{row.name}</h1>
        <p className="text-sm text-muted-foreground">Viewer access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground md:text-3xl">
          {row.name}
        </h1>
        <p className="text-sm text-muted-foreground">{row.phone}</p>
      </div>
      <LeadDetailTabs
        leadId={id}
        initialMappings={(mappings ?? []) as LeadSupplyMappingRow[]}
        profileForm={
          <LeadForm
            mode="edit"
            areas={areas ?? []}
            staff={staff ?? []}
            initial={initial}
            defaultAssignedTo={assignment?.assigned_to ?? null}
            isAdmin={profile?.role === "admin"}
            convertedSupplyId={convertedSupplyId}
            convertedSupplyLabel={convertedSupplyLabel}
          />
        }
      />
    </div>
  );
}
