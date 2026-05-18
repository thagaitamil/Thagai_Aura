"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { SlidersHorizontal, X } from "lucide-react";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

type Staff = { id: string; full_name: string | null; email: string | null };
type Area  = { id: string; label: string };

export function DashboardFilters({ staff, areas }: { staff: Staff[]; areas: Area[] }) {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();
  const [, start] = useTransition();

  const get = (k: string) => params.get(k) ?? "";

  const set = useCallback(
    (key: string, value: string) => {
      const p = new URLSearchParams(params.toString());
      if (value) p.set(key, value); else p.delete(key);
      start(() => router.replace(`${pathname}?${p.toString()}`));
    },
    [router, pathname, params]
  );

  const clear = useCallback(() => {
    start(() => router.replace(pathname));
  }, [router, pathname]);

  const FILTER_KEYS = ["date_from", "date_to", "salesperson", "area", "lead_status", "service_type"];
  const hasFilters = FILTER_KEYS.some((k) => params.has(k));

  return (
    <div className="sticky top-0 z-20 rounded-xl border border-border/80 bg-card/95 backdrop-blur-sm p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal className="size-4" />
          Dashboard filters
        </div>
        {hasFilters && (
          <button
            onClick={clear}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-3" /> Clear
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">From date</label>
          <input
            type="date"
            className={selectClass}
            value={get("date_from")}
            onChange={(e) => set("date_from", e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">To date</label>
          <input
            type="date"
            className={selectClass}
            value={get("date_to")}
            onChange={(e) => set("date_to", e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Salesperson</label>
          <select className={selectClass} value={get("salesperson")} onChange={(e) => set("salesperson", e.target.value)}>
            <option value="">All</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name ?? s.email ?? s.id}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Area</label>
          <select className={selectClass} value={get("area")} onChange={(e) => set("area", e.target.value)}>
            <option value="">All areas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Lead status</label>
          <select className={selectClass} value={get("lead_status")} onChange={(e) => set("lead_status", e.target.value)}>
            <option value="">All statuses</option>
            <option value="new_lead">New lead</option>
            <option value="mql">MQL</option>
            <option value="sql">SQL</option>
            <option value="good_lead">Good lead</option>
            <option value="hot_lead">Hot lead</option>
            <option value="converted">Converted</option>
            <option value="closed_lost">Closed lost</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Service type</label>
          <select className={selectClass} value={get("service_type")} onChange={(e) => set("service_type", e.target.value)}>
            <option value="">All types</option>
            <option value="caretaker">Caretaker</option>
            <option value="nurse">Nurse</option>
            <option value="12h">12 hours</option>
            <option value="24h">24 hours</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>
    </div>
  );
}
