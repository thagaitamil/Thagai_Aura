"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PickerPopover } from "@/components/shared/picker-popover";
import { formatSupplyDisplayId } from "@/lib/display-ids";
import { cn } from "@/lib/utils";
import { Loader2, Search, UserRoundCheck } from "lucide-react";

type Row = { id: string; full_name: string; supply_number: number | null };

export function ConvertedSupplyPicker({
  initialSupplyId,
  initialLabel,
}: {
  initialSupplyId?: string | null;
  initialLabel?: string | null;
}) {
  const [q, setQ] = useState(initialLabel ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedId, setSelectedId] = useState(initialSupplyId ?? "");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    if (!q.trim()) {
      setRows([]);
      return;
    }
    const controller = new AbortController();
    const seq = searchSeq.current + 1;
    searchSeq.current = seq;
    const t = setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const res = await fetch(
            `/api/supply/picker-search?q=${encodeURIComponent(q.trim())}`,
            { credentials: "include", signal: controller.signal }
          );
          if (seq !== searchSeq.current) return;
          if (!res.ok) {
            setRows([]);
            return;
          }
          const data = (await res.json()) as { rows?: Row[] };
          setRows(data.rows ?? []);
        } catch {
          if (!controller.signal.aborted) setRows([]);
        } finally {
          if (seq === searchSeq.current) setLoading(false);
        }
      })();
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [q]);

  function pick(r: Row) {
    setSelectedId(r.id);
    setQ(`${r.full_name} (${formatSupplyDisplayId(r.supply_number)})`);
    setRows([]);
    setOpen(false);
  }

  return (
    <div className="space-y-2 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <Label htmlFor="converted_supply_search">Assigned supply (converted)</Label>
      <p className="text-xs text-muted-foreground">
        Search by name or supply ID (e.g. S00042). Required when status is Converted.
      </p>
      <input type="hidden" name="converted_primary_supply" value={selectedId} />
      <div
        ref={rootRef}
        className="relative"
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
            setOpen(false);
          }
        }}
      >
        <div className="relative" ref={inputWrapRef}>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="converted_supply_search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSelectedId("");
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              }
            }}
            className="aura-picker-control"
            placeholder="Search supply name or S00042…"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls="converted-supply-results"
          />
        </div>
        <PickerPopover
            id="converted-supply-results"
            open={open && (loading || rows.length > 0)}
            anchorRef={inputWrapRef}
          >
            {loading && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Searching…
              </div>
            )}
            {rows.map((r) => (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={selectedId === r.id}
                className={cn(
                  "aura-picker-option flex-col items-start gap-1",
                  selectedId === r.id && "bg-muted",
                )}
                onClick={() => pick(r)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <UserRoundCheck className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{r.full_name}</span>
                </span>
                <span className="pl-6 font-mono text-xs text-muted-foreground">
                  {formatSupplyDisplayId(r.supply_number)}
                </span>
              </button>
            ))}
        </PickerPopover>
      </div>
    </div>
  );
}
