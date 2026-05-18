import Link from "next/link";
import { Plus, Clock, AlertCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, canWriteLeads } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { LeadFilters } from "@/components/leads/lead-filters";
import { format, isPast } from "date-fns";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  new_lead: "bg-slate-100 text-slate-700 border-slate-200",
  mql: "bg-blue-50 text-blue-700 border-blue-200",
  sql: "bg-indigo-50 text-indigo-700 border-indigo-200",
  good_lead: "bg-violet-50 text-violet-700 border-violet-200",
  hot_lead: "bg-orange-50 text-orange-700 border-orange-200",
  converted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed_lost: "bg-red-50 text-red-600 border-red-200",
};

export default async function LeadsListPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = createClient();
  const { profile } = await getSessionProfile();

  const p = (key: string) => {
    const v = searchParams[key];
    return typeof v === "string" ? v : "";
  };

  // Fetch supporting data for filters
  const [{ data: areas }, { data: staff }] = await Promise.all([
    supabase.from("area_options").select("id, label").order("label"),
    supabase.from("profiles").select("id, full_name, email").eq("active", true).order("full_name"),
  ]);

  // Base query
  let query = supabase
    .from("leads")
    .select(
      `id, name, phone, status, follow_up_required, follow_up_at, created_at, created_by,
       requirement_type, service_duration, budget_max,
       lead_assignments(assigned_to, profiles:assigned_to(full_name, email))`
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(300);

  // Role-based scope — sales only sees their leads
  if (profile?.role === "sales") {
    const { data: assigned } = await supabase
      .from("lead_assignments")
      .select("lead_id")
      .eq("assigned_to", profile.id);
    const { data: created } = await supabase
      .from("leads")
      .select("id")
      .eq("created_by", profile.id)
      .is("deleted_at", null);
    const ids = new Set<string>();
    assigned?.forEach((a) => ids.add(a.lead_id));
    created?.forEach((c) => ids.add(c.id));
    const list = Array.from(ids);
    if (!list.length) {
      return (
        <div className="space-y-4">
          <h1 className="font-serif text-2xl font-semibold">Leads</h1>
          <p className="text-muted-foreground text-sm">
            No leads assigned to you yet. Create a new lead or ask ops to assign you.
          </p>
          {canWriteLeads(profile.role) && (
            <Link href="/leads/new" className={cn(buttonVariants(), "inline-flex items-center gap-2 bg-accent text-accent-foreground hover:bg-accent/90")}>
              <Plus className="size-4" /> Add lead
            </Link>
          )}
        </div>
      );
    }
    query = query.in("id", list);
  }

  // Apply filters
  if (p("status")) query = query.eq("status", p("status"));
  if (p("req_type")) query = query.eq("requirement_type", p("req_type"));
  if (p("gender_pref")) query = query.eq("gender_preference", p("gender_pref"));
  if (p("duration")) query = query.eq("service_duration", p("duration"));
  if (p("budget_max")) query = query.lte("budget_max", Number(p("budget_max")));
  if (p("followup") === "required") query = query.eq("follow_up_required", true);
  if (p("followup") === "none") query = query.eq("follow_up_required", false);
  if (p("followup") === "overdue") {
    query = query
      .eq("follow_up_required", true)
      .not("follow_up_at", "is", null)
      .lt("follow_up_at", new Date().toISOString());
  }

  const { data: rows } = await query;

  // Post-filter by area tag
  let filtered = rows ?? [];
  if (p("area")) {
    const { data: taggedIds } = await supabase
      .from("lead_area_tags")
      .select("lead_id")
      .eq("area_option_id", p("area"));
    const ids = new Set((taggedIds ?? []).map((t) => t.lead_id));
    filtered = filtered.filter((r) => ids.has(r.id));
  }

  // Post-filter by assignee
  if (p("assignee") === "unassigned") {
    filtered = filtered.filter((r) => {
      const a = Array.isArray(r.lead_assignments) ? r.lead_assignments : [];
      return a.length === 0;
    });
  } else if (p("assignee")) {
    filtered = filtered.filter((r) => {
      const a = Array.isArray(r.lead_assignments) ? r.lead_assignments : [];
      return a.some((x: Record<string, unknown>) => x.assigned_to === p("assignee"));
    });
  }

  const canWrite = profile && canWriteLeads(profile.role);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-foreground md:text-3xl">
            Leads
          </h1>
          <p className="text-sm text-muted-foreground">
            {profile?.role === "sales"
              ? `Showing ${filtered.length} leads assigned to you.`
              : `${filtered.length} lead${filtered.length !== 1 ? "s" : ""} in the pipeline.`}
          </p>
        </div>
        {canWrite && (
          <Link
            href="/leads/new"
            className={cn(buttonVariants(), "inline-flex items-center gap-2 bg-accent text-accent-foreground hover:bg-accent/90")}
          >
            <Plus className="size-4" /> Add lead
          </Link>
        )}
      </div>

      <LeadFilters areas={areas ?? []} staff={staff ?? []} />

      <div className="rounded-xl border border-border/80 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned to</TableHead>
              <TableHead>Follow-up</TableHead>
              <TableHead className="text-right">Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const assignments = Array.isArray(r.lead_assignments) ? r.lead_assignments : [];
              const assignee = assignments[0]?.profiles as { full_name?: string; email?: string } | undefined;
              const assigneeName = assignee?.full_name ?? assignee?.email ?? null;

              const isOverdue =
                r.follow_up_required &&
                r.follow_up_at &&
                isPast(new Date(r.follow_up_at as string)) &&
                r.status !== "converted" &&
                r.status !== "closed_lost";

              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.phone}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("capitalize", STATUS_COLORS[r.status as string] ?? "")}
                    >
                      {String(r.status).replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {assigneeName ?? <span className="italic text-muted-foreground/60">Unassigned</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {isOverdue ? (
                      <span className="flex items-center gap-1 text-destructive font-medium">
                        <AlertCircle className="size-3.5" />
                        Overdue
                      </span>
                    ) : r.follow_up_required && r.follow_up_at ? (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="size-3.5" />
                        {format(new Date(r.follow_up_at as string), "dd MMM, HH:mm")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/leads/${r.id}`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
            {!filtered.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No leads match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
