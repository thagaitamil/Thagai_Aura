"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

type Area = { id: string; label: string };

export function SupplyFilters({ areas }: { areas: Area[] }) {
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
        router.replace(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, searchParams]
  );

  const clear = useCallback(() => {
    startTransition(() => {
      router.replace(pathname);
    });
  }, [router, pathname]);

  const hasFilters = [
    "type", "gender", "availability", "status", "verified", "blacklisted", "area", "salary_max", "language",
  ].some((k) => searchParams.has(k));

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
          <label className="text-xs font-medium text-muted-foreground">Type</label>
          <select className={selectClass} value={get("type")} onChange={(e) => set("type", e.target.value)}>
            <option value="">All types</option>
            <option value="caretaker">Caretaker</option>
            <option value="nurse">Nurse</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Gender</label>
          <select className={selectClass} value={get("gender")} onChange={(e) => set("gender", e.target.value)}>
            <option value="">Any gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Availability</label>
          <select className={selectClass} value={get("availability")} onChange={(e) => set("availability", e.target.value)}>
            <option value="">Any</option>
            <option value="12h">12 hours</option>
            <option value="24h">24 hours</option>
            <option value="monthly">Monthly stay</option>
            <option value="part_time">Part-time</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <select className={selectClass} value={get("status")} onChange={(e) => set("status", e.target.value)}>
            <option value="">All statuses</option>
            <option value="available">Available</option>
            <option value="on_duty">On duty</option>
            <option value="trial">Trial</option>
            <option value="reserved">Reserved</option>
            <option value="temp_unavailable">Temp unavailable</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Verification</label>
          <select className={selectClass} value={get("verified")} onChange={(e) => set("verified", e.target.value)}>
            <option value="">Any</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="not_verified">Not verified</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Blacklisted</label>
          <select className={cn(selectClass, get("blacklisted") === "true" ? "border-destructive text-destructive" : "")} value={get("blacklisted")} onChange={(e) => set("blacklisted", e.target.value)}>
            <option value="">All</option>
            <option value="false">Not blacklisted</option>
            <option value="true">Blacklisted only</option>
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
          <label className="text-xs font-medium text-muted-foreground">Max salary (12h) ₹</label>
          <input
            type="number"
            className={selectClass}
            placeholder="e.g. 15000"
            value={get("salary_max")}
            onChange={(e) => set("salary_max", e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Language</label>
          <input
            type="text"
            className={selectClass}
            placeholder="e.g. Tamil, English"
            value={get("language")}
            onChange={(e) => set("language", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
