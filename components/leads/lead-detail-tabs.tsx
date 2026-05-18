"use client";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import {
  CalendarClock,
  FileText,
  MessageSquare,
  UserCircle,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  addLeadActivity,
  addLeadFollowUpRow,
  saveLeadMappings,
  setLeadFollowUpOutcome,
  setMappingReserved,
  updateMappingTrial,
  uploadLeadDocument,
} from "@/lib/actions/leads";
import { getSignedCrmDocUrl } from "@/lib/actions/documents";

export type LeadSupplyMappingRow = {
  id: string;
  priority: number;
  supply_id: string;
  trial_status: string;
  is_reserved: boolean;
  supply_profiles: { full_name: string; status: string; type: string } | null;
};

export type LeadFollowUpRow = {
  id: string;
  due_at: string;
  notes: string | null;
  outcome: string | null;
  completed_at: string | null;
  created_at: string;
};

const NAV_ITEMS = [
  { value: "profile",      label: "Lead",             Icon: UserCircle    },
  { value: "followups",    label: "Follow-ups",        Icon: CalendarClock },
  { value: "conversation", label: "Conversation",      Icon: MessageSquare },
  { value: "mapping",      label: "Suggested supply",  Icon: Users         },
  { value: "documents",    label: "Documents",         Icon: FileText      },
] as const;

export function LeadDetailTabs({
  leadId,
  activities: activitiesProp,
  followUps: followUpsProp,
  mappings,
  supplies,
  documents: documentsProp,
  profileForm,
}: {
  leadId: string;
  activities: Record<string, unknown>[];
  followUps: LeadFollowUpRow[];
  mappings: LeadSupplyMappingRow[];
  supplies: { id: string; full_name: string; type: string; status: string }[];
  documents: Record<string, unknown>[];
  profileForm: React.ReactNode;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("profile");
  const [actType, setActType] = useState("note");
  const [actNotes, setActNotes] = useState("");

  // Optimistic lists
  const [activities, setActivities] = useState(activitiesProp);
  const [followUps, setFollowUps] = useState(followUpsProp);
  const [documents, setDocuments] = useState(documentsProp);

  useEffect(() => setActivities(activitiesProp), [activitiesProp]);
  useEffect(() => setFollowUps(followUpsProp), [followUpsProp]);
  useEffect(() => setDocuments(documentsProp), [documentsProp]);

  const p1 = mappings.find((m) => m.priority === 1)?.supply_id ?? "";
  const p2 = mappings.find((m) => m.priority === 2)?.supply_id ?? "";
  const p3 = mappings.find((m) => m.priority === 3)?.supply_id ?? "";

  const [m1, setM1] = useState(p1);
  const [m2, setM2] = useState(p2);
  const [m3, setM3] = useState(p3);

  useEffect(() => {
    setM1(p1); setM2(p2); setM3(p3);
  }, [p1, p2, p3]);

  function syncRefresh() {
    startTransition(() => { router.refresh(); });
  }

  async function submitActivity(e: React.FormEvent) {
    e.preventDefault();
    const r = await addLeadActivity(leadId, actType, actNotes);
    if (r.error) toast.error(r.error);
    else {
      toast.success("Logged");
      setActivities((prev) => [
        {
          id: crypto.randomUUID(),
          activity_type: actType,
          notes: actNotes || null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setActNotes("");
      syncRefresh();
    }
  }

  async function handleSaveMapping() {
    const chosen = [m1, m2, m3].filter(Boolean);
    const unique = new Set(chosen);
    if (unique.size < chosen.length) {
      toast.error("Each priority must use a different supply profile.");
      return;
    }
    const r = await saveLeadMappings(leadId, m1, m2, m3);
    if (r.error) toast.error(r.error);
    else {
      toast.success("Mapping saved");
      syncRefresh();
    }
  }

  return (
    <div className="flex flex-col md:flex-row md:items-start gap-0 md:gap-6">
      {/* ── Vertical nav — outside Tabs so sticky works reliably ── */}
      <div className="shrink-0 w-full md:w-48 self-start sticky top-0 z-10">
        <div className="
          flex md:flex-col
          overflow-x-auto md:overflow-x-visible
          gap-1 pb-2 md:pb-0
          bg-transparent
          w-full
          md:rounded-xl md:border md:border-border/80 md:bg-card md:p-2 md:shadow-sm
        ">
          {NAV_ITEMS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              className={cn(
                "flex items-center gap-2 shrink-0 rounded-lg px-3 py-2",
                "text-sm font-medium justify-start w-auto md:w-full whitespace-nowrap",
                "bg-transparent hover:bg-muted/60 hover:text-foreground transition-colors",
                activeTab === value
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content panels ──────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-w-0">
      <div className="flex-1 min-w-0">

        {/* Lead profile */}
        <TabsContent value="profile" className="mt-0">
          {profileForm}
        </TabsContent>

        {/* Follow-ups */}
        <TabsContent value="followups" className="mt-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg">Schedule a follow-up</CardTitle>
              <p className="text-sm text-muted-foreground">
                Adds a row to history and updates the lead&apos;s next follow-up fields.
              </p>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 md:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const fd = new FormData(form);
                  const dueAt = String(fd.get("due_at") || "");
                  const notes = String(fd.get("notes") || "");
                  const r = await addLeadFollowUpRow(leadId, fd);
                  if (r.error) toast.error(r.error);
                  else {
                    toast.success("Follow-up scheduled");
                    setFollowUps((prev) => [
                      {
                        id: crypto.randomUUID(),
                        due_at: dueAt ? new Date(dueAt).toISOString() : new Date().toISOString(),
                        notes: notes || null,
                        outcome: "pending",
                        completed_at: null,
                        created_at: new Date().toISOString(),
                      },
                      ...prev,
                    ]);
                    form.reset();
                    syncRefresh();
                  }
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="fu_due">Due</Label>
                  <Input id="fu_due" name="due_at" type="datetime-local" required />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="fu_notes">Notes</Label>
                  <Textarea id="fu_notes" name="notes" rows={2} placeholder="Optional context" />
                </div>
                <button
                  type="submit"
                  className={cn(buttonVariants(), "w-fit bg-accent text-accent-foreground hover:bg-accent/90")}
                >
                  Add follow-up
                </button>
              </form>
            </CardContent>
          </Card>
          <div>
            <h3 className="mb-2 font-medium">History</h3>
            <ul className="space-y-2 text-sm">
              {followUps.map((fu) => {
                const pending = fu.outcome === "pending" || fu.outcome == null;
                return (
                  <li key={fu.id} className="rounded-lg border border-border/80 bg-card p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-foreground">
                        Due {format(new Date(fu.due_at), "dd MMM yyyy HH:mm")}
                      </span>
                      <Badge variant={pending ? "default" : "secondary"} className="capitalize">
                        {(fu.outcome ?? "pending").replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Logged {format(new Date(fu.created_at), "dd MMM yyyy HH:mm")}
                    </p>
                    {typeof fu.notes === "string" && fu.notes.length > 0 && (
                      <p className="whitespace-pre-wrap text-foreground">{fu.notes}</p>
                    )}
                    {fu.completed_at && !pending && (
                      <p className="text-xs text-muted-foreground">
                        Closed {format(new Date(fu.completed_at), "dd MMM yyyy HH:mm")}
                      </p>
                    )}
                    {pending && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {(["completed", "missed", "rescheduled"] as const).map((outcome) => (
                          <button
                            key={outcome}
                            type="button"
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 capitalize")}
                            onClick={async () => {
                              const r = await setLeadFollowUpOutcome(fu.id, leadId, outcome);
                              if (r.error) toast.error(r.error);
                              else {
                                toast.success(`Marked ${outcome}`);
                                setFollowUps((prev) =>
                                  prev.map((f) => f.id === fu.id ? { ...f, outcome } : f)
                                );
                                syncRefresh();
                              }
                            }}
                          >
                            {outcome}
                          </button>
                        ))}
                        <button
                          type="button"
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 text-muted-foreground")}
                          onClick={async () => {
                            const r = await setLeadFollowUpOutcome(fu.id, leadId, "cancelled");
                            if (r.error) toast.error(r.error);
                            else {
                              toast.success("Cancelled");
                              setFollowUps((prev) =>
                                prev.map((f) => f.id === fu.id ? { ...f, outcome: "cancelled" } : f)
                              );
                              syncRefresh();
                            }
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
              {!followUps.length && (
                <p className="text-muted-foreground">No follow-up rows yet — add one above.</p>
              )}
            </ul>
          </div>
        </TabsContent>

        {/* Conversation */}
        <TabsContent value="conversation" className="mt-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg">Add timeline entry</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitActivity} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={actType}
                    onChange={(e) => setActType(e.target.value)}
                  >
                    <option value="inquiry">Initial inquiry</option>
                    <option value="shared_pricing">Shared pricing</option>
                    <option value="requested_change">Requested change</option>
                    <option value="followup_done">Follow-up done</option>
                    <option value="trial_scheduled">Trial scheduled</option>
                    <option value="trial_completed">Trial completed</option>
                    <option value="converted">Converted</option>
                    <option value="closed">Closed</option>
                    <option value="note">Note</option>
                  </select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Notes</Label>
                  <Textarea rows={3} value={actNotes} onChange={(e) => setActNotes(e.target.value)} />
                </div>
                <button
                  type="submit"
                  className={cn(buttonVariants(), "w-fit bg-accent text-accent-foreground hover:bg-accent/90")}
                >
                  Add entry
                </button>
              </form>
            </CardContent>
          </Card>
          <ul className="space-y-2 text-sm">
            {activities.map((a) => (
              <li key={String(a.id)} className="rounded-lg border border-border/80 bg-card p-3">
                <div className="flex justify-between text-muted-foreground">
                  <span className="font-medium capitalize text-foreground">
                    {String(a.activity_type).replace(/_/g, " ")}
                  </span>
                  <span>{format(new Date(String(a.created_at)), "dd MMM yyyy HH:mm")}</span>
                </div>
                {typeof a.notes === "string" && a.notes.length > 0 && (
                  <p className="mt-2 whitespace-pre-wrap">{a.notes}</p>
                )}
              </li>
            ))}
            {!activities.length && <p className="text-muted-foreground">No entries yet.</p>}
          </ul>
        </TabsContent>

        {/* Suggested supply */}
        <TabsContent value="mapping" className="mt-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg">Priority shortlist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {([
                  { label: "Priority 1", val: m1, set: setM1, exclude: [m2, m3] },
                  { label: "Priority 2", val: m2, set: setM2, exclude: [m1, m3] },
                  { label: "Priority 3", val: m3, set: setM3, exclude: [m1, m2] },
                ] as const).map(({ label, val, set, exclude }) => (
                  <div key={label} className="space-y-2">
                    <Label>{label}</Label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={val}
                      onChange={(e) => set(e.target.value)}
                    >
                      <option value="">—</option>
                      {supplies.map((s) => (
                        <option
                          key={s.id}
                          value={s.id}
                          disabled={exclude.includes(s.id)}
                        >
                          {s.full_name} ({s.type}){exclude.includes(s.id) ? " — already selected" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className={cn(buttonVariants(), "bg-accent text-accent-foreground hover:bg-accent/90")}
                onClick={handleSaveMapping}
              >
                Save mapping
              </button>
            </CardContent>
          </Card>
          <div className="rounded-xl border border-border/80 bg-card p-4 space-y-4">
            <h3 className="font-medium">Current matches</h3>
            {mappings.map((m) => (
              <div key={m.id} className="flex flex-col gap-2 border-b border-border/60 pb-3 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    P{m.priority} · {m.supply_profiles?.full_name ?? m.supply_id}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {m.supply_profiles?.type} · {m.supply_profiles?.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Label className="text-xs">Trial</Label>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    defaultValue={m.trial_status}
                    onChange={async (e) => {
                      const r = await updateMappingTrial(m.id, leadId, e.target.value);
                      if (r.error) toast.error(r.error);
                      else { toast.success("Updated"); syncRefresh(); }
                    }}
                  >
                    <option value="suggested">Suggested</option>
                    <option value="shared">Shared with customer</option>
                    <option value="trial_scheduled">Trial scheduled</option>
                    <option value="trial_completed">Trial completed</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={m.is_reserved}
                      onChange={async (e) => {
                        const r = await setMappingReserved(m.id, leadId, e.target.checked);
                        if (r.error) toast.error(r.error);
                        else syncRefresh();
                      }}
                    />
                    Reserved
                  </label>
                </div>
              </div>
            ))}
            {!mappings.length && (
              <p className="text-sm text-muted-foreground">No supply linked yet.</p>
            )}
          </div>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="mt-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg">Upload</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 md:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const fd = new FormData(form);
                  fd.set("lead_id", leadId);
                  const docType = String(fd.get("doc_type") || "");
                  const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
                  const fileName = fileInput?.files?.[0]?.name ?? "";
                  const r = await uploadLeadDocument(fd);
                  if (r.error) toast.error(r.error);
                  else {
                    toast.success("Uploaded");
                    if (fileName) {
                      setDocuments((prev) => [
                        {
                          id: crypto.randomUUID(),
                          doc_type: docType,
                          file_name: fileName,
                          storage_path: "",
                          created_at: new Date().toISOString(),
                        },
                        ...prev,
                      ]);
                    }
                    form.reset();
                    syncRefresh();
                  }
                }}
              >
                <input type="hidden" name="lead_id" value={leadId} />
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select
                    name="doc_type"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="agreement">Agreement</option>
                    <option value="id_proof">ID proof</option>
                    <option value="address_proof">Address proof</option>
                    <option value="medical">Medical</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>File</Label>
                  <Input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png" />
                </div>
                <button
                  type="submit"
                  className={cn(buttonVariants(), "w-fit bg-accent text-accent-foreground hover:bg-accent/90")}
                >
                  Upload
                </button>
              </form>
            </CardContent>
          </Card>
          <ul className="space-y-2 text-sm">
            {documents.map((d) => (
              <li key={String(d.id)} className="flex flex-wrap justify-between gap-2 rounded-lg border border-border/60 bg-card p-3">
                <span>
                  <span className="capitalize">{String(d.doc_type).replace(/_/g, " ")}</span>
                  {" — "}{String(d.file_name)}
                </span>
                <button
                  type="button"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  onClick={async () => {
                    const res = await getSignedCrmDocUrl(String(d.storage_path));
                    if ("error" in res && res.error) toast.error(res.error);
                    else if ("url" in res && res.url) window.open(res.url, "_blank");
                  }}
                >
                  Open
                </button>
              </li>
            ))}
            {!documents.length && (
              <p className="text-muted-foreground text-sm">No documents uploaded yet.</p>
            )}
          </ul>
        </TabsContent>

      </div>
      </Tabs>
    </div>
  );
}
