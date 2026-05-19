"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createLead, updateLead } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AreaTagPicker } from "@/components/shared/area-tag-picker";
import { ConvertedSupplyPicker } from "@/components/leads/converted-supply-picker";
import { formatTrailId } from "@/lib/display-ids";
import { signalAuraNavigationStart } from "@/lib/navigation-loading";
import { titleCaseName } from "@/lib/text-format";

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
  end_date: string | null;
  service_is_ongoing: boolean;
  special_notes: string | null;
  status: string;
  follow_up_required: boolean;
  follow_up_at: string | null;
  follow_up_notes: string | null;
  trail_number?: number | null;
};

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function LeadForm({
  mode,
  areas,
  staff,
  initial,
  defaultAssignedTo,
  convertedSupplyId,
  convertedSupplyLabel,
}: {
  mode: "create" | "edit";
  areas: Area[];
  staff: Staff[];
  initial?: LeadRow & { area_option_ids?: string[] };
  defaultAssignedTo?: string | null;
  isAdmin?: boolean;
  convertedSupplyId?: string | null;
  convertedSupplyLabel?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState(initial?.status ?? "new_lead");
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");
  const [serviceIsOngoing, setServiceIsOngoing] = useState(initial?.service_is_ongoing ?? false);

  // Keep pipeline status in sync when server sends updated lead (e.g. after refresh).
  useEffect(() => {
    if (initial?.status) setStatus(initial.status);
  }, [initial?.status]);

  useEffect(() => {
    setStartDate(initial?.start_date ?? "");
    setEndDate(initial?.end_date ?? "");
    setServiceIsOngoing(initial?.service_is_ongoing ?? false);
  }, [initial?.start_date, initial?.end_date, initial?.service_is_ongoing]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res =
      mode === "create" ? await createLead(fd) : await updateLead(initial!.id, fd);
    setPending(false);
    if ("error" in res && res.error) {
      setFormError(res.error);
      toast.error(res.error);
      return;
    }
    setFormError(null);
    toast.success(mode === "create" ? "Lead created" : "Saved");
    if (mode === "create" && "id" in res && res.id) {
      signalAuraNavigationStart();
      router.push(`/leads/${res.id}`);
    } else {
      router.refresh();
    }
  }

  const areaIds = initial?.area_option_ids ?? [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = !serviceIsOngoing && endDate ? new Date(`${endDate}T00:00:00`) : null;
  const serviceStatus = !start
    ? { label: "Schedule not set", className: "border-border bg-muted text-muted-foreground" }
    : start > today
      ? { label: "Starting soon", className: "border-sky-200 bg-sky-50 text-sky-700" }
      : end && end < today
        ? { label: "Completed", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
        : { label: "Ongoing", className: "border-amber-200 bg-amber-50 text-amber-700" };

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {mode === "edit" && initial?.trail_number != null && (
        <p className="text-sm text-muted-foreground">
          Trail ID:{" "}
          <span className="font-mono font-semibold text-foreground">
            {formatTrailId(initial.trail_number)}
          </span>
        </p>
      )}

      {formError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {formError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name" required>Name</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={initial?.name}
              onBlur={(event) => {
                event.currentTarget.value = titleCaseName(event.currentTarget.value);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" required>Phone</Label>
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
          <div className="md:col-span-2">
            <AreaTagPicker
              initialSelectedIds={areaIds}
              initialAreas={areas}
              label="Area / location tags"
              hint="Search existing locations or add a new one for the whole team."
            />
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
            <Label htmlFor="requirement_type" required>Requirement type</Label>
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
            <Label htmlFor="gender_preference" required>Gender preference</Label>
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
            <Label htmlFor="service_duration" required>Service duration</Label>
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
            <Input
              id="start_date"
              name="start_date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="end_date">End date</Label>
              <Badge variant="outline" className={serviceStatus.className}>
                {serviceStatus.label}
              </Badge>
            </div>
            <Input
              id="end_date"
              name="end_date"
              type="date"
              value={serviceIsOngoing ? "" : endDate}
              disabled={serviceIsOngoing}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              id="service_is_ongoing"
              name="service_is_ongoing"
              checked={serviceIsOngoing}
              onChange={(event) => setServiceIsOngoing(event.target.checked)}
              className="size-4 rounded border border-input"
            />
            Continuing service / no end date yet
          </label>
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground md:col-span-2">
            Lead service status is calculated from the start date and end date. If there is no planned end date, mark it as continuing.
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
            <Label htmlFor="status" required>Lead status</Label>
            <select
              id="status"
              name="status"
              className={selectClass}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="new_lead">New lead</option>
              <option value="mql">MQL</option>
              <option value="sql">SQL</option>
              <option value="good_lead">Good lead</option>
              <option value="hot_lead">Hot lead</option>
              <option value="converted">Converted</option>
              <option value="closed_lost">Closed lost</option>
            </select>
          </div>
          {status === "converted" ? (
            <div className="md:col-span-2">
              <ConvertedSupplyPicker
                initialSupplyId={convertedSupplyId ?? undefined}
                initialLabel={convertedSupplyLabel ?? undefined}
              />
            </div>
          ) : (
            <input type="hidden" name="converted_primary_supply" value="" />
          )}
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
