"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { FileText, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

type LeadHit = { id: string; name: string; phone: string; sub?: string };
type SupplyHit = { id: string; full_name: string; phone: string; sub?: string };

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [leads, setLeads] = React.useState<LeadHit[]>([]);
  const [supply, setSupply] = React.useState<SupplyHit[]>([]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    if (!open) {
      setQ("");
      setLeads([]);
      setSupply([]);
      return;
    }
    const t = q.trim();
    if (t.length < 2) {
      setLeads([]);
      setSupply([]);
      setLoading(false);
      return;
    }
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(t)}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          setLeads([]);
          setSupply([]);
          return;
        }
        const data = (await res.json()) as {
          leads?: LeadHit[];
          supply?: SupplyHit[];
        };
        setLeads(data.leads ?? []);
        setSupply(data.supply ?? []);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(id);
  }, [q, open]);

  function go(path: string) {
    setOpen(false);
    router.push(path);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 text-muted-foreground md:hidden"
        aria-label="Open search"
        onClick={() => setOpen(true)}
      >
        <Search className="size-5" />
      </Button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden rounded-lg border border-input bg-muted/40 px-3 py-1.5 text-left text-sm text-muted-foreground md:block md:min-w-[200px]"
      >
        Search leads & supply…
        <kbd className="pointer-events-none ml-2 hidden rounded border bg-muted px-1 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Find leads and supply by name, phone, area or reference"
        className="max-w-lg"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Name, phone, area or reference…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Searching…" : q.trim().length < 2 ? "Enter 2+ characters." : "No results."}
            </CommandEmpty>
            {leads.length > 0 && (
              <CommandGroup heading="Leads">
                {leads.map((l) => (
                  <CommandItem
                    key={l.id}
                    value={`lead-${l.id}`}
                    onSelect={() => go(`/leads/${l.id}`)}
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">{l.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {l.sub ?? l.phone}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {leads.length > 0 && supply.length > 0 && <CommandSeparator />}
            {supply.length > 0 && (
              <CommandGroup heading="Supply">
                {supply.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={`supply-${s.id}`}
                    onSelect={() => go(`/supply/${s.id}`)}
                  >
                    <Users className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">{s.full_name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {s.sub ?? s.phone}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          <div className="border-t px-3 py-2 text-xs text-muted-foreground">
            <kbd className="rounded border bg-muted px-1 font-mono">⌘K</kbd> open ·{" "}
            <kbd className="rounded border bg-muted px-1 font-mono">Esc</kbd> close
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}
