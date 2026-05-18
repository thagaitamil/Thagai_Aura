import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, canWriteLeads } from "@/lib/auth/session";
import { LeadForm } from "@/components/leads/lead-form";
import {
  LeadDetailTabs,
  type LeadFollowUpRow,
  type LeadSupplyMappingRow,
} from "@/components/leads/lead-detail-tabs";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createClient();
  const { profile } = await getSessionProfile();
  const { data: row } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!row) notFound();

  const { data: tagRows } = await supabase
    .from("lead_area_tags")
    .select("area_option_id")
    .eq("lead_id", id);

  const { data: areas } = await supabase
    .from("area_options")
    .select("id, label")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("active", true)
    .order("full_name", { ascending: true });

  const { data: assignment } = await supabase
    .from("lead_assignments")
    .select("assigned_to")
    .eq("lead_id", id)
    .maybeSingle();

  const { data: activities } = await supabase
    .from("lead_activities")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: mappings } = await supabase
    .from("supply_mapping")
    .select("*, supply_profiles(full_name, status, type)")
    .eq("lead_id", id)
    .order("priority", { ascending: true });

  const { data: docs } = await supabase
    .from("lead_documents")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  const { data: followUps } = await supabase
    .from("lead_follow_ups")
    .select("id, due_at, notes, outcome, completed_at, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: supplies } = await supabase
    .from("supply_profiles")
    .select("id, full_name, type, status")
    .is("deleted_at", null)
    .order("full_name", { ascending: true })
    .limit(500);

  const canWrite = profile && canWriteLeads(profile.role);
  const initial = {
    ...row,
    area_option_ids: (tagRows ?? []).map((t) => t.area_option_id),
  };

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
        activities={activities ?? []}
        followUps={(followUps ?? []) as LeadFollowUpRow[]}
        mappings={(mappings ?? []) as LeadSupplyMappingRow[]}
        supplies={supplies ?? []}
        documents={docs ?? []}
        profileForm={
          <LeadForm
            mode="edit"
            areas={areas ?? []}
            staff={staff ?? []}
            initial={initial}
            defaultAssignedTo={assignment?.assigned_to ?? null}
          />
        }
      />
    </div>
  );
}
