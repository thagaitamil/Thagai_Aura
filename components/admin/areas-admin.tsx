"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createAreaOption, toggleAreaOption } from "@/lib/actions/areas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

type Row = {
  id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export function AreasAdmin({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData();
    fd.set("label", label);
    const r = await createAreaOption(fd);
    setPending(false);
    if (r.error) toast.error(r.error);
    else {
      toast.success("Area added");
      setLabel("");
      router.refresh();
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Add area tag</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Adyar, OMR, Velachery…"
                required
              />
            </div>
            <Button type="submit" disabled={pending} className="bg-accent text-accent-foreground">
              Add
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="rounded-xl border border-border/80 bg-card">
        <ul className="divide-y">
          {initial.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="font-medium">{r.label}</span>
              <div className="flex items-center gap-2">
                <Badge variant={r.is_active ? "secondary" : "outline"}>
                  {r.is_active ? "Active" : "Inactive"}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const r2 = await toggleAreaOption(r.id, !r.is_active);
                    if (r2.error) toast.error(r2.error);
                    else {
                      toast.success("Updated");
                      router.refresh();
                    }
                  }}
                >
                  {r.is_active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </li>
          ))}
          {!initial.length && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              No tags yet. Add your first Chennai area above.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
