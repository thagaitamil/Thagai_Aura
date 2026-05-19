"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PickerPopover } from "@/components/shared/picker-popover";
import { INDIAN_LANGUAGES, languagesToStored } from "@/lib/constants/indian-languages";
import { cn } from "@/lib/utils";

export function LanguagePicker({
  initialSelected,
  fieldName = "languages",
}: {
  initialSelected: string[];
  fieldName?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(() =>
    initialSelected.filter((value, index, arr) => value && arr.indexOf(value) === index)
  );

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return INDIAN_LANGUAGES;
    return INDIAN_LANGUAGES.filter(
      (language) =>
        language.label.toLowerCase().includes(query) ||
        language.value.toLowerCase().includes(query)
    );
  }, [q]);

  function toggle(value: string) {
    setSelected((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
    setQ("");
    setOpen(true);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="language_search">Languages</Label>
      <p className="text-xs text-muted-foreground">Search and select all languages that apply.</p>
      <input type="hidden" name={fieldName} value={languagesToStored(selected)} />

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((value) => {
            const label = INDIAN_LANGUAGES.find((language) => language.value === value)?.label ?? value;
            return (
              <span
                key={value}
                className="aura-picker-chip"
              >
                <Check className="size-3.5 text-primary" />
                {label}
                <button
                  type="button"
                  className="aura-picker-chip-remove min-h-6 min-w-6"
                  onClick={() => toggle(value)}
                  aria-label={`Remove ${label}`}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            );
          })}
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
            id="language_search"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
              }
            }}
            className="aura-picker-control !pl-10 !pr-3"
            placeholder="Search languages…"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls="language-picker-results"
          />
        </div>

        <PickerPopover
            id="language-picker-results"
            open={open}
            anchorRef={inputWrapRef}
          >
            {filtered.length === 0 ? (
              <div className="rounded-lg px-3 py-2 text-sm text-muted-foreground">
                No languages found.
              </div>
            ) : (
              filtered.map((language) => {
                const checked = selectedSet.has(language.value);
                return (
                  <Button
                    key={language.value}
                    type="button"
                    variant="ghost"
                    role="option"
                    aria-selected={checked}
                    className={cn(
                      "aura-picker-option h-auto justify-start font-normal",
                      checked && "bg-muted"
                    )}
                    onClick={() => toggle(language.value)}
                  >
                    <Check className={cn("size-4", checked ? "opacity-100" : "opacity-0")} />
                    <span>{language.label}</span>
                  </Button>
                );
              })
            )}
            <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              Select multiple, then click outside when done.
            </div>
        </PickerPopover>
      </div>
    </div>
  );
}
