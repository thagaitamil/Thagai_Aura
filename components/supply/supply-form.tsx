"use client";

import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";
import { createSupply, updateSupply } from "@/lib/actions/supply";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AreaTagPicker } from "@/components/shared/area-tag-picker";
import { storedToLanguages } from "@/lib/constants/indian-languages";
import { LanguagePicker } from "@/components/shared/language-picker";
import { formatSupplyDisplayId } from "@/lib/display-ids";
import { signalAuraNavigationStart } from "@/lib/navigation-loading";
import { titleCaseName } from "@/lib/text-format";

type Area = { id: string; label: string };

type SupplyRow = {
  id: string;
  full_name: string;
  phone: string;
  alt_phone: string | null;
  address: string | null;
  district: string | null;
  state: string | null;
  gender: string | null;
  age: number | null;
  type: string;
  availability: string;
  service_scope: string;
  languages: string | null;
  salary_12h: number | null;
  salary_24h: number | null;
  salary_monthly: number | null;
  verification_status: string;
  verification_notes: string | null;
  verification_manual_override?: boolean | null;
  aadhaar_number?: string | null;
  supply_number?: number | null;
  status: string;
  is_blacklisted: boolean;
  area_free_text: string | null;
};

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SupplyForm({
  mode,
  areas,
  initial,
  isAdmin,
}: {
  mode: "create" | "edit";
  areas: Area[];
  initial?: SupplyRow & { area_option_ids?: string[] };
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const langSel = useMemo(
    () => storedToLanguages(initial?.languages ?? null),
    [initial?.languages]
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    const res =
      mode === "create"
        ? await createSupply(fd)
        : await updateSupply(initial!.id, fd);
    setPending(false);
    if ("error" in res && res.error) {
      setFormError(res.error);
      toast.error(res.error);
      return;
    }
    setFormError(null);
    toast.success(mode === "create" ? "Supply created" : "Saved");
    if (mode === "create" && "id" in res && res.id) {
      signalAuraNavigationStart();
      router.push(`/supply/${res.id}`);
    } else {
      startTransition(() => {
        router.refresh();
      });
    }
  }

  const areaIds = initial?.area_option_ids ?? [];

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {mode === "edit" && initial?.supply_number != null && (
        <p className="text-sm text-muted-foreground">
          Supply ID:{" "}
          <span className="font-mono font-semibold text-foreground">
            {formatSupplyDisplayId(initial.supply_number)}
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
          <CardTitle className="font-serif text-lg">Basic details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="full_name" required>Full name</Label>
            <Input
              id="full_name"
              name="full_name"
              required
              defaultValue={initial?.full_name}
              onBlur={(event) => {
                event.currentTarget.value = titleCaseName(event.currentTarget.value);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aadhaar_number">Aadhaar number (12 digits)</Label>
            <Input
              id="aadhaar_number"
              name="aadhaar_number"
              inputMode="numeric"
              pattern="\d{12}"
              maxLength={12}
              placeholder="123456789012"
              defaultValue={initial?.aadhaar_number ?? ""}
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
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" rows={2} defaultValue={initial?.address ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="district">District</Label>
            <Input id="district" name="district" defaultValue={initial?.district ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input id="state" name="state" defaultValue={initial?.state ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <select
              id="gender"
              name="gender"
              className={cn(selectClass)}
              defaultValue={initial?.gender ?? ""}
            >
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              name="age"
              type="number"
              min={16}
              max={100}
              defaultValue={initial?.age ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Service areas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service_scope">Service scope</Label>
            <select
              id="service_scope"
              name="service_scope"
              className={selectClass}
              defaultValue={initial?.service_scope ?? "chennai_all"}
            >
              <option value="chennai_all">All Chennai</option>
              <option value="chennai_areas">Specific areas in Chennai</option>
              <option value="outside_chennai">Outside Chennai</option>
            </select>
          </div>
          <AreaTagPicker
            initialSelectedIds={areaIds}
            initialAreas={areas}
            label="Locations served"
            hint="Search existing locations or add a new one. It is saved for the whole team."
          />
          <div className="space-y-2">
            <Label htmlFor="area_free_text">Optional area / location notes (free text)</Label>
            <Textarea
              id="area_free_text"
              name="area_free_text"
              rows={2}
              placeholder="e.g. Near OMR, prefers south Chennai…"
              defaultValue={initial?.area_free_text ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Professional</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              name="type"
              className={selectClass}
              defaultValue={initial?.type ?? "caretaker"}
            >
              <option value="caretaker">Caretaker</option>
              <option value="nurse">Nurse</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="availability">Availability</Label>
            <select
              id="availability"
              name="availability"
              className={selectClass}
              defaultValue={initial?.availability ?? "12h"}
            >
              <option value="12h">12 hours</option>
              <option value="24h">24 hours</option>
              <option value="monthly">Monthly stay</option>
              <option value="part_time">Part-time</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <LanguagePicker initialSelected={langSel} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="salary_12h">Expected salary (12h)</Label>
            <Input
              id="salary_12h"
              name="salary_12h"
              type="number"
              step="0.01"
              defaultValue={initial?.salary_12h ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="salary_24h">Expected salary (24h)</Label>
            <Input
              id="salary_24h"
              name="salary_24h"
              type="number"
              step="0.01"
              defaultValue={initial?.salary_24h ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="salary_monthly">Monthly expectation</Label>
            <Input
              id="salary_monthly"
              name="salary_monthly"
              type="number"
              step="0.01"
              defaultValue={initial?.salary_monthly ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Operational status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="status">Operational status</Label>
            <select id="status" name="status" className={selectClass} defaultValue={initial?.status ?? "available"}>
              <option value="available">Available</option>
              <option value="on_duty">On duty</option>
              <option value="trial">Trial</option>
              <option value="reserved">Reserved</option>
              <option value="temp_unavailable">Temporarily unavailable</option>
              <option value="inactive">Permanently inactive</option>
            </select>
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <input
              type="checkbox"
              id="is_blacklisted"
              name="is_blacklisted"
              value="on"
              defaultChecked={initial?.is_blacklisted}
              className="size-4 rounded border border-input"
            />
            <Label htmlFor="is_blacklisted">Blacklisted</Label>
          </div>
        </CardContent>
      </Card>

      {!isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Status:{" "}
              <span className="font-medium capitalize text-foreground">
                {(initial?.verification_status ?? "pending").replace(/_/g, " ")}
              </span>
            </p>
            <p>
              When both <strong>Aadhaar</strong> and <strong>Smart card</strong> are uploaded under
              Documents, this profile is marked <strong>verified</strong> automatically unless an admin
              locks or overrides verification after document review.
            </p>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Verification (admin)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="verification_status">Verification status</Label>
              <select
                id="verification_status"
                name="verification_status"
                className={selectClass}
                defaultValue={initial?.verification_status ?? "pending"}
              >
                <option value="verified">Verified</option>
                <option value="pending">Pending</option>
                <option value="not_verified">Not verified</option>
              </select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="verification_notes">Verification notes</Label>
              <Textarea
                id="verification_notes"
                name="verification_notes"
                rows={3}
                defaultValue={initial?.verification_notes ?? ""}
              />
            </div>
            <div className="flex items-start gap-2 md:col-span-2">
              <input
                type="checkbox"
                id="allow_auto_verify"
                name="allow_auto_verify"
                value="on"
                defaultChecked={!(initial?.verification_manual_override ?? false)}
                className="mt-1 size-4 rounded border border-input"
              />
              <div>
                <Label htmlFor="allow_auto_verify">Allow automatic verification from documents</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Turn off after marking someone not verified (e.g. fake documents) so the system does not
                  flip them back to verified when both files are present.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="bg-accent text-accent-foreground">
          {pending ? "Saving…" : mode === "create" ? "Create supply" : "Save changes"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
