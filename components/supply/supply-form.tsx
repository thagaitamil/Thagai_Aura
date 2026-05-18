"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { createSupply, updateSupply } from "@/lib/actions/supply";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
}: {
  mode: "create" | "edit";
  areas: Area[];
  initial?: SupplyRow & { area_option_ids?: string[] };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res =
      mode === "create"
        ? await createSupply(fd)
        : await updateSupply(initial!.id, fd);
    setPending(false);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(mode === "create" ? "Supply created" : "Saved");
    if (mode === "create" && "id" in res && res.id) {
      router.push(`/supply/${res.id}`);
    } else {
      startTransition(() => {
        router.refresh();
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Basic details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              name="full_name"
              required
              defaultValue={initial?.full_name}
            />
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
          <div className="space-y-2">
            <Label>Area tags (admin-managed)</Label>
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
              {!areas.length && (
                <p className="text-sm text-muted-foreground">
                  No area tags yet. Ask an admin to add them under Admin → Area tags.
                </p>
              )}
            </div>
          </div>
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
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="languages">Languages (comma-separated)</Label>
            <Input id="languages" name="languages" defaultValue={initial?.languages ?? ""} />
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
          <CardTitle className="font-serif text-lg">Verification & status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="verification_status">Verification</Label>
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
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="verification_notes">Verification notes</Label>
            <Textarea
              id="verification_notes"
              name="verification_notes"
              rows={3}
              defaultValue={initial?.verification_notes ?? ""}
            />
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
