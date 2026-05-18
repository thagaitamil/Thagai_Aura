"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createLead, updateLead } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type Area = { id: string; label: string };
type Staff = { id: string; full_name: string | null; email: string | null };

type LeadRow = {
  id: string;
  name: string;
  phone: string;
  alt_phone: string | null;
  area_free_text: string | null;
  full_address: string | null;
  requirement_type: string;
  gender_preference: string;
  service_duration: string;
  budget_min: number | null;
  budget_max: number | null;
  start_date: string | null;
  special_notes: string | null;
  status: string;
  follow_up_required: boolean;
  follow_up_at: string | null;
  follow_up_notes: string | null;
};

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function LeadForm({
  mode,
  areas,
  staff,
  initial,
  defaultAssignedTo,
}: {
  mode: "create" | "edit";
  areas: Area[];
  staff: Staff[];
  initial?: LeadRow & { area_option_ids?: string[] };
  defaultAssignedTo?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res =
      mode === "create" ? await createLead(fd) : await updateLead(initial!.id, fd);
    setPending(false);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(mode === "create" ? "Lead created" : "Saved");
    if (mode === "create" && "id" in res && res.id) {
      router.push(`/leads/${res.id}`);
    } else {
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required defaultValue={initial?.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" required defaultValue={initial?.phone} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="alt_phone">Alternate phone</Label>
            <Input id="alt_phone" name="alt_phone" defaultValue={initial?.alt_phone ?? ""} />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="full_address">Full address</Label>
            <Textarea id="full_address" name="full_address" rows={2} defaultValue={initial?.full_address ?? ""} />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Area tags</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {areas.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="area_option_id"
                    value={a.id}
                    defaultChecked={initial?.area_option_ids?.includes(a.id)}
                    className="size-4 rounded border border-input"
                  />
                  {a.label}
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="area_free_text">Optional area notes (free text)</Label>
            <Textarea id="area_free_text" name="area_free_text" rows={2} defaultValue={initial?.area_free_text ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Requirement</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="requirement_type">Requirement type</Label>
            <select
              id="requirement_type"
              name="requirement_type"
              className={selectClass}
              defaultValue={initial?.requirement_type ?? "caretaker"}
            >
              <option value="caretaker">Caretaker</option>
              <option value="nurse">Nurse</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender_preference">Gender preference</Label>
            <select
              id="gender_preference"
              name="gender_preference"
              className={selectClass}
              defaultValue={initial?.gender_preference ?? "any"}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="any">No preference</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="service_duration">Service duration</Label>
            <select
              id="service_duration"
              name="service_duration"
              className={selectClass}
              defaultValue={initial?.service_duration ?? "12h"}
            >
              <option value="12h">12 hours</option>
              <option value="24h">24 hours</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="start_date">Start date</Label>
            <Input id="start_date" name="start_date" type="date" defaultValue={initial?.start_date ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget_min">Budget min</Label>
            <Input id="budget_min" name="budget_min" type="number" step="0.01" defaultValue={initial?.budget_min ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget_max">Budget max</Label>
            <Input id="budget_max" name="budget_max" type="number" step="0.01" defaultValue={initial?.budget_max ?? ""} />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="special_notes">Special requirements</Label>
            <Textarea id="special_notes" name="special_notes" rows={3} defaultValue={initial?.special_notes ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Pipeline & follow-up</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="status">Lead status</Label>
            <select id="status" name="status" className={selectClass} defaultValue={initial?.status ?? "new_lead"}>
              <option value="new_lead">New lead</option>
              <option value="mql">MQL</option>
              <option value="sql">SQL</option>
              <option value="good_lead">Good lead</option>
              <option value="hot_lead">Hot lead</option>
              <option value="converted">Converted</option>
              <option value="closed_lost">Closed lost</option>
            </select>
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <input
              type="checkbox"
              id="follow_up_required"
              name="follow_up_required"
              value="on"
              defaultChecked={initial?.follow_up_required}
              className="size-4 rounded border border-input"
            />
            <Label htmlFor="follow_up_required">Follow-up required</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="follow_up_at">Follow-up date & time</Label>
            <Input
              id="follow_up_at"
              name="follow_up_at"
              type="datetime-local"
              defaultValue={
                initial?.follow_up_at
                  ? initial.follow_up_at.slice(0, 16)
                  : ""
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="follow_up_notes">Follow-up notes</Label>
            <Textarea id="follow_up_notes" name="follow_up_notes" rows={2} defaultValue={initial?.follow_up_notes ?? ""} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="assigned_to">Assigned salesperson / ops</Label>
            <select
              id="assigned_to"
              name="assigned_to"
              className={selectClass}
              defaultValue={defaultAssignedTo ?? ""}
            >
              <option value="">— None —</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name ?? s.email ?? s.id}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="bg-accent text-accent-foreground">
          {pending ? "Saving…" : mode === "create" ? "Create lead" : "Save changes"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
