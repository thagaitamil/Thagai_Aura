import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import type {
  LeadDayDatum,
  LeadStatusDatum,
  SupplyTypeDatum,
} from "@/components/dashboard/dashboard-charts";
import { eachDayOfInterval, format, startOfDay, subDays, parseISO } from "date-fns";
import { AlertCircle, Users, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { CACHE_TTL_SECONDS, cached } from "@/lib/cache/redis";
import { cacheTags } from "@/lib/cache/tags";

export const dynamic = "force-dynamic";

const STATUS_ORDER = [
  "new_lead", "mql", "sql", "good_lead", "hot_lead", "converted", "closed_lost",
] as const;

function MetricTile({
  title,
  value,
  sub,
  accent,
  warning,
  href,
}: {
  title: string;
  value: number;
  sub?: string;
  accent?: boolean;
  warning?: boolean;
  href?: string;
}) {
  const inner = (
    <Card className={cn(
      "border-border/80 shadow-sm transition-shadow",
      href && "cursor-pointer hover:shadow-md hover:border-border",
      warning && value > 0 && "border-destructive/40 bg-destructive/5",
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          {warning && value > 0 && <AlertCircle className="size-3.5 text-destructive" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("font-serif text-3xl font-semibold", accent ? "text-primary" : warning && value > 0 ? "text-destructive" : "text-foreground")}>
          {value}
        </p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        {href && <p className="mt-2 text-xs text-primary/70 font-medium">View →</p>}
      </CardContent>
    </Card>
  );
  if (href) return <Link href={href} className="block">{inner}</Link>;
  return inner;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = createClient();
  const { profile } = await getSessionProfile();

  const p = (k: string) => { const v = searchParams[k]; return typeof v === "string" ? v : ""; };

  // Parse filter params
  const filterDateFrom = p("date_from") ? parseISO(p("date_from")) : null;
  const filterDateTo   = p("date_to")   ? parseISO(p("date_to"))   : null;
  const filterSalesperson = p("salesperson");
  const filterArea        = p("area");
  const filterLeadStatus  = p("lead_status");
  const filterServiceType = p("service_type");

  const endDay   = filterDateTo   ? startOfDay(filterDateTo)   : startOfDay(new Date());
  const startDay = filterDateFrom ? startOfDay(filterDateFrom) : startOfDay(subDays(endDay, 13));
  const nowIso = new Date().toISOString();
  const todayStart = startOfDay(new Date()).toISOString();
  const todayEnd = new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

  // Fetch filter dropdowns
  const dashboardKey = JSON.stringify({
    date_from: p("date_from"),
    date_to: p("date_to"),
    salesperson: p("salesperson"),
    area: p("area"),
    lead_status: p("lead_status"),
    service_type: p("service_type"),
    hour: format(new Date(), "yyyy-MM-dd-HH"),
  });

  const [staffList, areaList] = await Promise.all([
    cached({
      key: "profiles:active:sorted",
      tags: [cacheTags.profiles],
      ttlSeconds: CACHE_TTL_SECONDS,
      getFresh: async () => {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("active", true)
          .order("full_name");
        return data ?? [];
      },
    }),
    cached({
      key: "areas:all:label-sorted",
      tags: [cacheTags.areas],
      ttlSeconds: CACHE_TTL_SECONDS,
      getFresh: async () => {
        const { data } = await supabase.from("area_options").select("id, label").order("label");
        return data ?? [];
      },
    }),
  ]);

  // Helper: get lead IDs matching area/salesperson filters
  let filteredLeadIds: string[] | null = null;
  if (filterArea || filterSalesperson) {
    let leadIdSet: Set<string> | null = null;
    if (filterArea) {
      const { data: tagged } = await supabase
        .from("lead_area_tags").select("lead_id").eq("area_option_id", filterArea);
      const ids = new Set((tagged ?? []).map((t) => t.lead_id as string));
      const prev1 = leadIdSet;
      leadIdSet = prev1 ? new Set<string>((Array.from(prev1) as string[]).filter((id) => ids.has(id))) : ids;
    }
    if (filterSalesperson) {
      const { data: assigned } = await supabase
        .from("lead_assignments").select("lead_id").eq("assigned_to", filterSalesperson);
      const ids = new Set<string>((assigned ?? []).map((a) => a.lead_id as string));
      const prev2 = leadIdSet;
      leadIdSet = prev2 ? new Set<string>((Array.from(prev2) as string[]).filter((id) => ids.has(id))) : ids;
    }
    filteredLeadIds = Array.from(leadIdSet ?? []);
  }

  // Build a reusable leads base query helper
  function leadsBase() {
    let q = supabase.from("leads").select("id", { count: "exact", head: true }).is("deleted_at", null);
    if (filteredLeadIds) q = q.in("id", filteredLeadIds.length ? filteredLeadIds : ["__none__"]);
    if (filterLeadStatus) q = q.eq("status", filterLeadStatus);
    if (filterServiceType === "caretaker" || filterServiceType === "nurse")
      q = q.eq("requirement_type", filterServiceType);
    if (filterServiceType === "12h" || filterServiceType === "24h" || filterServiceType === "monthly")
      q = q.eq("service_duration", filterServiceType);
    if (filterDateFrom) q = q.gte("created_at", filterDateFrom.toISOString());
    if (filterDateTo)   q = q.lte("created_at", new Date(filterDateTo.setHours(23,59,59,999)).toISOString());
    return q;
  }

  function statusRowsBase() {
    let q = supabase.from("leads").select("status").is("deleted_at", null).limit(8000);
    if (filteredLeadIds) q = q.in("id", filteredLeadIds.length ? filteredLeadIds : ["__none__"]);
    if (filterLeadStatus) q = q.eq("status", filterLeadStatus);
    if (filterServiceType === "caretaker" || filterServiceType === "nurse")
      q = q.eq("requirement_type", filterServiceType);
    if (filterServiceType === "12h" || filterServiceType === "24h" || filterServiceType === "monthly")
      q = q.eq("service_duration", filterServiceType);
    if (filterDateFrom) q = q.gte("created_at", filterDateFrom.toISOString());
    if (filterDateTo)   q = q.lte("created_at", endDay.toISOString());
    return q;
  }

  const [
    supplyTotal,
    leadsTotal,
    overdueFu,
    pendingFu,
    availableSupply,
    occupiedSupply,
    blacklistedSupply,
    verificationPending,
    trialsToday,
    statusRows,
    recentLeadRows,
    typeRows,
    staffRows,
    assignmentRows,
  ] = await cached({
    key: `dashboard:metrics:${profile?.id ?? "anon"}:${profile?.role ?? "none"}:${dashboardKey}`,
    tags: [cacheTags.dashboard, cacheTags.leads, cacheTags.supplyList, cacheTags.profiles, cacheTags.areas],
    ttlSeconds: CACHE_TTL_SECONDS,
    getFresh: async () =>
      Promise.all([
        supabase.from("supply_profiles").select("id", { count: "exact", head: true }).is("deleted_at", null),
        leadsBase(),
        // Overdue follow-ups
        leadsBase()
          .eq("follow_up_required", true)
          .not("follow_up_at", "is", null).lt("follow_up_at", nowIso)
          .neq("status", "converted").neq("status", "closed_lost"),
        // Pending future follow-ups
        leadsBase()
          .eq("follow_up_required", true)
          .not("follow_up_at", "is", null).gte("follow_up_at", nowIso)
          .neq("status", "converted").neq("status", "closed_lost"),
        supabase.from("supply_profiles").select("id", { count: "exact", head: true })
          .is("deleted_at", null).eq("status", "available"),
        supabase.from("supply_profiles").select("id", { count: "exact", head: true })
          .is("deleted_at", null).eq("status", "on_duty"),
        supabase.from("supply_profiles").select("id", { count: "exact", head: true })
          .is("deleted_at", null).eq("is_blacklisted", true),
        supabase.from("supply_profiles").select("id", { count: "exact", head: true })
          .is("deleted_at", null).eq("verification_status", "pending"),
        // Follow-ups due today (was mislabeled as trials)
        supabase.from("lead_follow_ups").select("id", { count: "exact", head: true })
          .gte("due_at", todayStart).lte("due_at", todayEnd),
        statusRowsBase(),
        (() => {
          let q = supabase.from("leads").select("created_at").is("deleted_at", null)
            .gte("created_at", startDay.toISOString()).lte("created_at", endDay.toISOString());
          if (filteredLeadIds) q = q.in("id", filteredLeadIds.length ? filteredLeadIds : ["__none__"]);
          return q;
        })(),
        supabase.from("supply_profiles").select("type").is("deleted_at", null).limit(8000),
        supabase.from("profiles").select("id, full_name, email").eq("active", true).order("full_name"),
        supabase.from("lead_assignments").select("lead_id, assigned_to"),
      ]),
  });

  // Lead status breakdown
  const statusCounts: Record<string, number> = {};
  for (const s of STATUS_ORDER) statusCounts[s] = 0;
  for (const row of statusRows.data ?? []) {
    const st = row.status as string;
    statusCounts[st] = (statusCounts[st] ?? 0) + 1;
  }
  const leadStatus: LeadStatusDatum[] = STATUS_ORDER.map((status) => ({
    status,
    label: status.replace(/_/g, " "),
    count: statusCounts[status] ?? 0,
  }));

  // Leads created over last 14 days
  const dayMap = new Map<string, number>();
  for (const d of eachDayOfInterval({ start: startDay, end: endDay })) {
    dayMap.set(format(d, "yyyy-MM-dd"), 0);
  }
  for (const row of recentLeadRows.data ?? []) {
    const k = format(new Date(row.created_at as string), "yyyy-MM-dd");
    if (dayMap.has(k)) dayMap.set(k, (dayMap.get(k) ?? 0) + 1);
  }
  const leadsByDay: LeadDayDatum[] = eachDayOfInterval({ start: startDay, end: endDay }).map((d) => ({
    date: format(d, "MMM d"),
    count: dayMap.get(format(d, "yyyy-MM-dd")) ?? 0,
  }));

  // Supply type breakdown
  let caretakers = 0, nurses = 0;
  for (const row of typeRows.data ?? []) {
    if (row.type === "caretaker") caretakers++;
    else if (row.type === "nurse") nurses++;
  }
  const supplyByType: SupplyTypeDatum[] = [
    { type: "caretaker", label: "Caretaker", count: caretakers, fill: "hsl(var(--chart-3))" },
    { type: "nurse", label: "Nurse", count: nurses, fill: "hsl(var(--chart-4))" },
  ].filter((s) => s.count > 0);

  // Salesperson metrics
  const assigneeLeadMap = new Map<string, string[]>();
  for (const a of assignmentRows.data ?? []) {
    const arr = assigneeLeadMap.get(a.assigned_to) ?? [];
    arr.push(a.lead_id);
    assigneeLeadMap.set(a.assigned_to, arr);
  }

  // For salesperson table, fetch leads with status grouped by assignee (respecting filters)
  let salespersonQuery = supabase
    .from("lead_assignments")
    .select("assigned_to, leads(id, status, follow_up_required, follow_up_at)");
  if (filterSalesperson) salespersonQuery = salespersonQuery.eq("assigned_to", filterSalesperson);
  const assignedLeadsData = await cached({
    key: `dashboard:salesperson:${profile?.id ?? "anon"}:${profile?.role ?? "none"}:${dashboardKey}`,
    tags: [cacheTags.dashboard, cacheTags.leads, cacheTags.profiles],
    ttlSeconds: CACHE_TTL_SECONDS,
    getFresh: async () => {
      const { data } = await salespersonQuery;
      return data ?? [];
    },
  });

  type SalespersonRow = {
    id: string;
    name: string;
    totalLeads: number;
    converted: number;
    overdueFu: number;
    activeFu: number;
  };
  const spMap = new Map<string, SalespersonRow>();
  for (const staff of staffRows.data ?? []) {
    spMap.set(staff.id, {
      id: staff.id,
      name: staff.full_name ?? staff.email ?? staff.id,
      totalLeads: 0,
      converted: 0,
      overdueFu: 0,
      activeFu: 0,
    });
  }

  for (const a of assignedLeadsData ?? []) {
    const row = spMap.get(a.assigned_to);
    if (!row) continue;
    const lead = (Array.isArray(a.leads) ? a.leads[0] : a.leads) as { id?: string; status: string; follow_up_required: boolean; follow_up_at: string | null } | null;
    if (!lead) continue;
    // Respect filteredLeadIds (area / combined salesperson+area filters)
    if (filteredLeadIds && lead.id && !filteredLeadIds.includes(lead.id)) continue;
    row.totalLeads++;
    if (lead.status === "converted") row.converted++;
    if (lead.follow_up_required && lead.follow_up_at) {
      if (new Date(lead.follow_up_at) < new Date()) row.overdueFu++;
      else row.activeFu++;
    }
  }

  const spRows = Array.from(spMap.values()).filter((r) => r.totalLeads > 0).sort((a, b) => b.totalLeads - a.totalLeads);

  // Leads without any follow-up scheduled
  const leadsWithoutFu = (leadsTotal.count ?? 0) - (pendingFu.count ?? 0) - (overdueFu.count ?? 0) - statusCounts.converted - statusCounts.closed_lost;

  const hasActiveFilters = !!(filterDateFrom || filterDateTo || filterSalesperson || filterArea || filterLeadStatus || filterServiceType);

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Master dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {profile?.full_name ?? profile?.email} · metrics refresh on load.
          {hasActiveFilters && (
            <span className="ml-2 inline-flex items-center rounded-full border border-amber-400/50 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              Filters active — metrics reflect filtered view
            </span>
          )}
        </p>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────── */}
  <DashboardFilters staff={staffList} areas={areaList} />

      {/* ── Lead Metrics ───────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <TrendingUp className="size-4" /> Lead metrics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile title="Total leads" value={leadsTotal.count ?? 0} accent href="/leads" />
          <MetricTile title="New leads" value={statusCounts.new_lead} sub="in intake" href="/leads?status=new_lead" />
          <MetricTile title="Hot leads" value={statusCounts.hot_lead + statusCounts.good_lead + statusCounts.sql + statusCounts.mql} sub="MQL + SQL + Good + Hot" href="/leads?status=hot_lead" />
          <MetricTile title="Converted" value={statusCounts.converted} sub="all time" href="/leads?status=converted" />
          <MetricTile title="Closed lost" value={statusCounts.closed_lost} href="/leads?status=closed_lost" />
          <MetricTile title="Overdue follow-ups" value={overdueFu.count ?? 0} warning href="/leads?followup=overdue" />
          <MetricTile title="Pending follow-ups" value={pendingFu.count ?? 0} sub="scheduled, not due yet" href="/leads?followup=pending" />
          <MetricTile title="No follow-up set" value={Math.max(0, leadsWithoutFu)} sub="active leads" href="/leads" />
        </div>
      </section>

      {/* ── Supply Metrics ─────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Users className="size-4" /> Supply metrics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile title="Total supply" value={supplyTotal.count ?? 0} accent href="/supply" />
          <MetricTile title="Available" value={availableSupply.count ?? 0} href="/supply?availability=available" />
          <MetricTile title="On duty / occupied" value={occupiedSupply.count ?? 0} href="/supply?status=on_duty" />
          <MetricTile
            title="Follow-ups due today"
            value={trialsToday.count ?? 0}
            sub="Scheduled for today"
            href="/leads?followup=due_today"
          />
          <MetricTile title="Verification pending" value={verificationPending.count ?? 0} warning href="/supply?verified=pending" />
          <MetricTile title="Blacklisted" value={blacklistedSupply.count ?? 0} warning href="/supply?blacklisted=true" />
          <MetricTile title="Caretakers" value={caretakers} href="/supply?type=caretaker" />
          <MetricTile title="Nurses" value={nurses} href="/supply?type=nurse" />
        </div>
      </section>

      {/* ── Charts ─────────────────────────────────────────── */}
      <DashboardCharts
        leadStatus={leadStatus}
        leadsByDay={leadsByDay}
        supplyByType={supplyByType}
      />

      {/* ── Salesperson Metrics ────────────────────────────── */}
      {spRows.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Users className="size-4" /> Salesperson metrics
          </h2>
          <Card className="border-border/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/80 bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Salesperson</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Leads</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Converted</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Pending F/U</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground text-destructive/80">Overdue F/U</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Conv. rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {spRows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3 text-center">{row.totalLeads}</td>
                      <td className="px-4 py-3 text-center text-emerald-700 font-medium">{row.converted}</td>
                      <td className="px-4 py-3 text-center">{row.activeFu}</td>
                      <td className={cn("px-4 py-3 text-center font-medium", row.overdueFu > 0 ? "text-destructive" : "text-muted-foreground")}>
                        {row.overdueFu}
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {row.totalLeads > 0 ? `${Math.round((row.converted / row.totalLeads) * 100)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      {/* ── Tips ───────────────────────────────────────────── */}
      <Card className="border-border/80 bg-card">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Tips</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Use <strong>⌘K</strong> (Mac) or <strong>Ctrl+K</strong> (Windows) to jump to a lead or supply profile by name or phone.
          </p>
          <p>
            On a lead, open <strong>Follow-ups</strong> to keep a dated history; closing an item still keeps the row with outcome for reporting.
          </p>
          <p>
            Use the filter panels on the Lead and Supply list pages to narrow results by status, area, assignee, and more.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
