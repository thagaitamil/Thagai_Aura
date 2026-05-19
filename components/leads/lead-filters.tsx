"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { signalAuraNavigationStart } from "@/lib/navigation-loading";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

type Area = { id: string; label: string };
type Staff = { id: string; full_name: string | null; email: string | null };

export function LeadFilters({ areas, staff }: { areas: Area[]; staff: Staff[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const get = (key: string) => searchParams.get(key) ?? "";

  const set = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      startTransition(() => {
        signalAuraNavigationStart();
        router.replace(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, searchParams]
  );

  const clear = useCallback(() => {
    startTransition(() => {
      signalAuraNavigationStart();
      router.replace(pathname);
    });
  }, [router, pathname]);

  const hasFilters = ["status", "req_type", "gender_pref", "duration", "area", "assignee", "followup", "budget_max"].some(
    (k) => searchParams.has(k)
  );

  return (
    <div className="sticky top-0 z-20 rounded-xl border border-border/80 bg-card/95 backdrop-blur-sm p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal className="size-4" />
          Filters
        </div>
        {hasFilters && (
          <button
            onClick={clear}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-3" /> Clear all
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <select className={selectClass} value={get("status")} onChange={(e) => set("status", e.target.value)}>
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
          <label className="text-xs font-medium text-muted-foreground">Requirement type</label>
          <select className={selectClass} value={get("req_type")} onChange={(e) => set("req_type", e.target.value)}>
            <option value="">Any type</option>
            <option value="caretaker">Caretaker</option>
            <option value="nurse">Nurse</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Gender preference</label>
          <select className={selectClass} value={get("gender_pref")} onChange={(e) => set("gender_pref", e.target.value)}>
            <option value="">Any</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="any">No preference</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Duration</label>
          <select className={selectClass} value={get("duration")} onChange={(e) => set("duration", e.target.value)}>
            <option value="">Any duration</option>
            <option value="12h">12 hours</option>
            <option value="24h">24 hours</option>
            <option value="monthly">Monthly</option>
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
          <label className="text-xs font-medium text-muted-foreground">Assigned to</label>
          <select className={selectClass} value={get("assignee")} onChange={(e) => set("assignee", e.target.value)}>
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name ?? s.email ?? s.id}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Follow-up</label>
          <select className={selectClass} value={get("followup")} onChange={(e) => set("followup", e.target.value)}>
            <option value="">All</option>
            <option value="due_today">Due today</option>
            <option value="required">Follow-up required</option>
            <option value="none">No follow-up</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Max budget ₹</label>
          <input
            type="number"
            className={selectClass}
            placeholder="e.g. 20000"
            value={get("budget_max")}
            onChange={(e) => set("budget_max", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
