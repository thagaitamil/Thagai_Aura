import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, canWriteSupply } from "@/lib/auth/session";
import { SupplyForm } from "@/components/supply/supply-form";
import { SupplyDetailTabs } from "@/components/supply/supply-detail-tabs";
import { SupplyPhotoUpload } from "@/components/supply/supply-photo-upload";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSignedCrmDocUrl } from "@/lib/actions/documents";
import { formatSupplyDisplayId } from "@/lib/display-ids";

export const dynamic = "force-dynamic";

export default async function SupplyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createClient();
  const { profile } = await getSessionProfile();
  const { data: row } = await supabase
    .from("supply_profiles")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!row) notFound();

  const { data: tagRows } = await supabase
    .from("supply_area_tags")
    .select("area_option_id")
    .eq("supply_id", id);

  const { data: areas } = await supabase
    .from("area_options")
    .select("id, label")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const { data: activities } = await supabase
    .from("supply_activities")
    .select("id, activity_type, notes, created_at, created_by")
    .eq("supply_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: refs } = await supabase
    .from("supply_references")
    .select("*")
    .eq("supply_id", id)
    .order("created_at", { ascending: false });

  const { data: risks } = await supabase
    .from("supply_risk_markers")
    .select("*")
    .eq("supply_id", id)
    .order("created_at", { ascending: false });

  const refIds = (refs ?? []).map((r) => r.id as string).filter(Boolean);
  const { data: refDocs } =
    refIds.length > 0
      ? await supabase
          .from("supply_reference_documents")
          .select("*")
          .in("reference_id", refIds)
          .order("created_at", { ascending: false })
      : { data: [] as Record<string, unknown>[] };

  const { data: mappingRows } = await supabase
    .from("supply_mapping")
    .select("lead_id, priority, trial_status, leads(id, name, phone, status, trail_number)")
    .eq("supply_id", id)
    .order("priority", { ascending: true });

  type AssignedLead = {
    lead_id: string;
    name: string;
    phone: string;
    status: string;
    trail_number: number | null;
    priority: number;
    trial_status: string;
  };
  const assignedLeads: AssignedLead[] = [];
  const seenLead = new Set<string>();
  for (const m of mappingRows ?? []) {
    const lid = m.lead_id as string;
    if (!lid || seenLead.has(lid)) continue;
    const raw = m.leads;
    const L = (Array.isArray(raw) ? raw[0] : raw) as {
      id: string;
      name: string;
      phone: string;
      status: string;
      trail_number: number | null;
    } | null;
    if (!L?.id) continue;
    seenLead.add(lid);
    assignedLeads.push({
      lead_id: L.id,
      name: L.name,
      phone: L.phone,
      status: L.status,
      trail_number: L.trail_number ?? null,
      priority: m.priority as number,
      trial_status: String(m.trial_status ?? ""),
    });
  }

  const { data: docs } = await supabase
    .from("supply_documents")
    .select("*")
    .eq("supply_id", id)
    .order("created_at", { ascending: false });

  const canWrite = profile && canWriteSupply(profile.role);

  // Get profile photo signed URL if available
  const photoDoc = (docs ?? []).find((d) => d.doc_type === "photo");
  let photoUrl: string | null = null;
  if (photoDoc?.storage_path) {
    const res = await getSignedCrmDocUrl(photoDoc.storage_path as string);
    if (!res.error && res.url) photoUrl = res.url;
  }

  // Count unresolved risks
  const unresolvedRisks = (risks ?? []).filter((r) => !r.resolved_at).length;

  if (!canWrite) {
    return (
      <div className="space-y-6 min-w-0">
        <SupplyProfileHeader
          name={row.full_name as string}
          phone={row.phone as string}
          type={row.type as string}
          status={row.status as string}
          isBlacklisted={row.is_blacklisted as boolean}
          verificationStatus={row.verification_status as string}
          unresolvedRisks={unresolvedRisks}
          photoUrl={photoUrl}
          supplyNumber={row.supply_number as number | null | undefined}
        />
        <p className="text-sm text-muted-foreground">Viewer access — contact admin for edits.</p>
      </div>
    );
  }

  const initial = {
    ...row,
    area_option_ids: (tagRows ?? []).map((t) => t.area_option_id),
  };

  return (
    <div className="space-y-6 min-w-0">
      <SupplyProfileHeader
        name={row.full_name as string}
        phone={row.phone as string}
        type={row.type as string}
        status={row.status as string}
        isBlacklisted={row.is_blacklisted as boolean}
        verificationStatus={row.verification_status as string}
        unresolvedRisks={unresolvedRisks}
        photoUrl={photoUrl}
        supplyId={id}
        canUploadPhoto
        supplyNumber={row.supply_number as number | null | undefined}
      />
      <SupplyDetailTabs
        supplyId={id}
        activities={activities ?? []}
        references={refs ?? []}
        referenceDocuments={refDocs ?? []}
        assignedLeads={assignedLeads}
        risks={risks ?? []}
        documents={docs ?? []}
        profileForm={
          <SupplyForm
            mode="edit"
            areas={areas ?? []}
            initial={initial}
            isAdmin={profile?.role === "admin"}
          />
        }
      />
    </div>
  );
}

function SupplyProfileHeader({
  name, phone, type, status, isBlacklisted, verificationStatus, unresolvedRisks, photoUrl,
  supplyId, canUploadPhoto, supplyNumber,
}: {
  name: string; phone: string; type: string; status: string;
  isBlacklisted: boolean; verificationStatus: string;
  unresolvedRisks: number; photoUrl: string | null;
  supplyId?: string; canUploadPhoto?: boolean;
  supplyNumber?: number | null;
}) {
  return (
    <div className="flex items-start gap-4">
      {/* Avatar — interactive upload for editors, static for viewers */}
      {canUploadPhoto && supplyId ? (
        <SupplyPhotoUpload supplyId={supplyId} initialUrl={photoUrl} />
      ) : photoUrl ? (
        <div className="relative size-16 rounded-full overflow-hidden border-2 border-border/80 shadow-sm shrink-0">
          <Image src={photoUrl} alt={name} fill className="object-cover" />
        </div>
      ) : (
        <div className="size-16 rounded-full border-2 border-border/80 bg-muted flex items-center justify-center shadow-sm shrink-0">
          <UserCircle className="size-8 text-muted-foreground/50" />
        </div>
      )}
      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-serif text-2xl font-semibold text-foreground md:text-3xl leading-tight">
            {name}
          </h1>
          {isBlacklisted && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="size-3" /> Blacklisted
            </Badge>
          )}
          {unresolvedRisks > 0 && !isBlacklisted && (
            <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 flex items-center gap-1">
              <AlertTriangle className="size-3" /> {unresolvedRisks} risk flag{unresolvedRisks > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Supply profile · {phone}
        </p>
        <div className="flex flex-wrap gap-2">
          {supplyNumber != null && (
            <Badge variant="secondary" className="font-mono text-xs">
              {formatSupplyDisplayId(supplyNumber)}
            </Badge>
          )}
          <Badge variant="outline" className="capitalize">{type}</Badge>
          <Badge
            variant={status === "available" ? "default" : "secondary"}
            className={cn("capitalize", status === "available" && "bg-emerald-600 text-white border-transparent")}
          >
            {status.replace(/_/g, " ")}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "capitalize",
              verificationStatus === "verified" && "bg-emerald-50 text-emerald-700 border-emerald-200"
            )}
          >
            {verificationStatus.replace(/_/g, " ")}
          </Badge>
        </div>
      </div>
    </div>
  );
}
