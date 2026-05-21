import Link from "next/link";
import Image from "next/image";
import { Plus, AlertTriangle, UserCircle } from "lucide-react";
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
import { getSessionProfile, canWriteSupply } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { SupplyFilters } from "@/components/supply/supply-filters";
import { formatSupplyDisplayId } from "@/lib/display-ids";
import { getSignedCrmDocUrl } from "@/lib/actions/documents";
import { CACHE_TTL_SECONDS, cached } from "@/lib/cache/redis";
import { cacheTags } from "@/lib/cache/tags";

export const dynamic = "force-dynamic";

export default async function SupplyListPage({
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

  const filterKey = JSON.stringify({
    type: p("type"),
    gender: p("gender"),
    availability: p("availability"),
    status: p("status"),
    verified: p("verified"),
    blacklisted: p("blacklisted"),
    salary_max: p("salary_max"),
    language: p("language"),
    area: p("area"),
  });

  const [areas, listData] = await Promise.all([
    cached({
      key: "areas:all:label-sorted",
      tags: [cacheTags.areas],
      ttlSeconds: CACHE_TTL_SECONDS,
      getFresh: async () => {
        const { data } = await supabase.from("area_options").select("id, label").order("label");
        return data ?? [];
      },
    }),
    cached({
      key: `supply-list:${profile?.id ?? "anon"}:${profile?.role ?? "none"}:${filterKey}`,
      tags: [cacheTags.supplyList, cacheTags.areas],
      ttlSeconds: CACHE_TTL_SECONDS,
      getFresh: async () => {
        let query = supabase
          .from("supply_profiles")
          .select(
            "id, full_name, phone, type, availability, status, verification_status, is_blacklisted, gender, salary_12h, supply_number"
          )
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(300);

        if (p("type")) query = query.eq("type", p("type"));
        if (p("gender")) query = query.eq("gender", p("gender"));
        if (p("availability")) query = query.eq("availability", p("availability"));
        if (p("status")) query = query.eq("status", p("status"));
        if (p("verified")) query = query.eq("verification_status", p("verified"));
        if (p("blacklisted") === "true") query = query.eq("is_blacklisted", true);
        if (p("blacklisted") === "false") query = query.eq("is_blacklisted", false);
        if (p("salary_max")) query = query.lte("salary_12h", Number(p("salary_max")));
        if (p("language")) query = query.ilike("languages", `%${p("language")}%`);

        const { data: rows } = await query;

        let filteredRows = rows ?? [];
        if (p("area")) {
          const { data: taggedIds } = await supabase
            .from("supply_area_tags")
            .select("supply_id")
            .eq("area_option_id", p("area"));
          const ids = new Set((taggedIds ?? []).map((t) => t.supply_id));
          filteredRows = filteredRows.filter((r) => ids.has(r.id));
        }

        const ids = filteredRows.map((r) => r.id);
        if (!ids.length) {
          return { rows: filteredRows, riskRows: [], photoRows: [] };
        }

        const [{ data: risks }, { data: photoDocs }] = await Promise.all([
          supabase
            .from("supply_risk_markers")
            .select("supply_id")
            .in("supply_id", ids)
            .is("resolved_at", null),
          supabase
            .from("supply_documents")
            .select("supply_id, storage_path")
            .in("supply_id", ids)
            .eq("doc_type", "photo")
            .order("created_at", { ascending: false }),
        ]);

        return {
          rows: filteredRows,
          riskRows: risks ?? [],
          photoRows: photoDocs ?? [],
        };
      },
    }),
  ]);

  const filtered = listData.rows;
  const riskMap = new Map<string, number>();
  const photoUrlMap = new Map<string, string>();

  for (const r of listData.riskRows) {
    riskMap.set(r.supply_id, (riskMap.get(r.supply_id) ?? 0) + 1);
  }

  const photoPathMap = new Map<string, string>();
  for (const d of listData.photoRows) {
    if (!photoPathMap.has(d.supply_id)) {
      photoPathMap.set(d.supply_id, d.storage_path as string);
    }
  }

  await Promise.all(
    Array.from(photoPathMap.entries()).map(async ([supplyId, path]) => {
      const res = await cached({
        key: `signed-url:supply-list-photo:${supplyId}:${path}`,
        tags: [cacheTags.supply(supplyId)],
        ttlSeconds: CACHE_TTL_SECONDS - 60,
        getFresh: () => getSignedCrmDocUrl(path),
      });
      if (!res.error && res.url) photoUrlMap.set(supplyId, res.url);
    })
  );

  const canWrite = profile && canWriteSupply(profile.role);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-foreground md:text-3xl">
            Supply
          </h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} caretaker{filtered.length !== 1 ? "s" : ""} / nurse{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canWrite && (
          <Link
            href="/supply/new"
            className={cn(
              buttonVariants(),
              "inline-flex items-center gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
            )}
          >
            <Plus className="size-4" />
            Add supply
          </Link>
        )}
      </div>

      <SupplyFilters areas={areas} />

      <div className="rounded-xl border border-border/80 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead className="font-mono text-xs">Supply</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Verified</TableHead>
              <TableHead className="text-right">Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const riskCount = riskMap.get(r.id) ?? 0;
              const photo = photoUrlMap.get(r.id) ?? null;
              return (
                <TableRow key={r.id} className={r.is_blacklisted ? "bg-destructive/5" : undefined}>
                  {/* Photo avatar */}
                  <TableCell className="pr-0">
                    <div className="relative size-9 rounded-full overflow-hidden border border-border/60 bg-muted shrink-0">
                      {photo ? (
                        <Image src={photo} alt={r.full_name as string} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <UserCircle className="size-5 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.supply_number != null ? formatSupplyDisplayId(r.supply_number as number) : "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {r.full_name}
                      {riskCount > 0 && !r.is_blacklisted && (
                        <span title={`${riskCount} unresolved risk flag${riskCount > 1 ? "s" : ""}`}>
                          <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                        </span>
                      )}
                      {r.is_blacklisted && (
                        <AlertTriangle className="size-3.5 text-destructive shrink-0" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.phone}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{r.type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground capitalize">
                    {String(r.availability).replace("_", " ")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={r.is_blacklisted ? "destructive" : "secondary"}
                      className="capitalize"
                    >
                      {r.is_blacklisted ? "Blacklisted" : String(r.status).replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={r.verification_status === "verified" ? "default" : "outline"}
                      className={cn(
                        "capitalize",
                        r.verification_status === "verified" && "bg-emerald-600 text-white border-transparent"
                      )}
                    >
                      {String(r.verification_status).replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/supply/${r.id}`}
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
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No supply profiles match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
