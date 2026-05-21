"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, MapPin, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { createAreaQuick } from "@/lib/actions/areas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PickerPopover } from "@/components/shared/picker-popover";

type Area = { id: string; label: string };

export function AreaTagPicker({
  fieldName = "area_option_id",
  label = "Service areas / locations",
  hint = "Search existing locations or add a new one (saved for everyone).",
  initialSelectedIds,
  initialAreas,
}: {
  fieldName?: string;
  label?: string;
  hint?: string;
  initialSelectedIds: string[];
  initialAreas: Area[];
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Area[]>(() => initialAreas.slice(0, 50));
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const searchSeq = useRef(0);
  const [selected, setSelected] = useState<Area[]>(() => {
    const map = new Map(initialAreas.map((a) => [a.id, a]));
    return initialSelectedIds
      .map((id) => map.get(id) ?? { id, label: id.slice(0, 8) + "…" })
      .filter(Boolean);
  });
  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);

  const refreshHits = useCallback(async (query: string, signal: AbortSignal, seq: number) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setHits(initialAreas.slice(0, 50));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/areas/search?q=${encodeURIComponent(trimmed)}`,
        { credentials: "include", signal }
      );
      if (seq !== searchSeq.current) return;
      if (!res.ok) {
        setHits([]);
        return;
      }
      const data = (await res.json()) as { areas?: Area[] };
      setHits(data.areas ?? []);
    } catch {
      if (!signal.aborted) setHits([]);
    } finally {
      if (seq === searchSeq.current) setLoading(false);
    }
  }, [initialAreas]);

  useEffect(() => {
    if (!open) return;
    if (!q.trim()) {
      setHits(initialAreas.slice(0, 50));
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const seq = searchSeq.current + 1;
    searchSeq.current = seq;
    const t = setTimeout(() => {
      void refreshHits(q, controller.signal, seq);
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [initialAreas, open, q, refreshHits]);

  function toggleArea(a: Area) {
    if (selectedIds.has(a.id)) {
      removeArea(a.id);
      return;
    }
    setSelected((prev) => [...prev, a]);
    setQ("");
    setHits([]);
    setOpen(true);
  }

  function removeArea(id: string) {
    setSelected((prev) => prev.filter((a) => a.id !== id));
  }

  async function addNewLocation() {
    const labelText = q.trim();
    if (labelText.length < 2) {
      toast.error("Type at least 2 characters to add a location.");
      return;
    }
    const res = await createAreaQuick(labelText);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    if ("id" in res && res.id) {
      toast.success("Location added");
      toggleArea({ id: res.id, label: labelText });
    }
  }

  const exactHit = hits.find((h) => h.label.toLowerCase() === q.trim().toLowerCase());
  const canShowCreate =
    q.trim().length >= 2 &&
    !exactHit &&
    !hits.some((h) => h.label.toLowerCase() === q.trim().toLowerCase());

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((a) => (
            <span
              key={a.id}
              className="aura-picker-chip"
            >
              <MapPin className="size-3.5 text-muted-foreground" />
              {a.label}
              <button
                type="button"
                className="aura-picker-chip-remove min-h-6 min-w-6"
                onClick={() => removeArea(a.id)}
                aria-label={`Remove ${a.label}`}
              >
                <X className="size-3.5" />
              </button>
              <input type="hidden" name={fieldName} value={a.id} />
            </span>
          ))}
        </div>
      )}

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
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              }
            }}
            className="aura-picker-control !pl-10 !pr-3"
            placeholder="Search or add a location…"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls="area-tag-picker-results"
          />
        </div>
        <PickerPopover
            id="area-tag-picker-results"
            open={open && (loading || hits.length > 0 || canShowCreate)}
            anchorRef={inputWrapRef}
          >
            {loading && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Searching…
              </div>
            )}
            {!loading &&
              hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  role="option"
                  aria-selected={selectedIds.has(h.id)}
                  className="aura-picker-option justify-between"
                  onClick={() => toggleArea(h)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <MapPin className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{h.label}</span>
                  </span>
                  {selectedIds.has(h.id) ? (
                    <Check className="size-4 text-primary" />
                  ) : (
                    <Plus className="size-4 text-muted-foreground" />
                  )}
                </button>
              ))}
            {!loading && canShowCreate && (
              <div className="mt-1 border-t border-border p-2">
                <Button type="button" variant="secondary" size="sm" className="h-9 w-full justify-start rounded-lg" onClick={addNewLocation}>
                  <Plus className="size-4" />
                  Add new location &quot;{q.trim()}&quot;
                </Button>
              </div>
            )}
            {!loading && (
              <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                Select multiple, then click outside when done.
              </div>
            )}
        </PickerPopover>
      </div>
    </div>
  );
}
