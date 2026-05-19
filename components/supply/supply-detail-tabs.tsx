"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DocumentUploadDialog, documentTypeLabel } from "@/components/shared/document-upload-dialog";
import { format } from "date-fns";
import { toast } from "sonner";
import { Activity as ActivityIcon, FileText, ShieldAlert, Upload, UserCircle, UserRoundCheck, Users } from "lucide-react";
import {
  addSupplyActivity,
  addSupplyReference,
  addSupplyRisk,
  resolveSupplyRisk,
  uploadSupplyDocument,
  uploadSupplyReferenceDocument,
} from "@/lib/actions/supply";
import { getSignedCrmDocUrl } from "@/lib/actions/documents";
import Link from "next/link";
import { formatTrailId } from "@/lib/display-ids";

type Activity = {
  id: string;
  activity_type: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
};

const NAV_ITEMS = [
  { value: "profile", label: "Profile", Icon: UserCircle },
  { value: "assigned", label: "Assigned leads", Icon: UserRoundCheck },
  { value: "documents", label: "Documents", Icon: FileText },
  { value: "activity", label: "Activity", Icon: ActivityIcon },
  { value: "references", label: "References", Icon: Users },
  { value: "risk", label: "Risk", Icon: ShieldAlert },
] as const;

const SUPPLY_DOCUMENT_TYPES = [
  { value: "aadhaar", label: "Aadhaar card" },
  { value: "smart_card", label: "Smart card" },
  { value: "photo", label: "Profile photo" },
  { value: "medical", label: "Medical certificate" },
  { value: "other", label: "Other" },
];

const REFERENCE_DOCUMENT_TYPES = [
  { value: "aadhaar", label: "Aadhaar card" },
  { value: "smart_card", label: "Smart card" },
  { value: "photo", label: "Photo" },
  { value: "medical", label: "Medical" },
  { value: "other", label: "Other" },
];

function refreshAfterMutation(router: ReturnType<typeof useRouter>) {
  startTransition(() => {
    router.refresh();
  });
}

export function SupplyDetailTabs({
  supplyId,
  activities: activitiesProp,
  references: referencesProp,
  referenceDocuments: referenceDocumentsProp,
  assignedLeads,
  risks: risksProp,
  documents: documentsProp,
  profileForm,
}: {
  supplyId: string;
  activities: Activity[];
  references: Record<string, unknown>[];
  referenceDocuments: Record<string, unknown>[];
  assignedLeads: {
    lead_id: string;
    name: string;
    phone: string;
    status: string;
    trail_number: number | null;
    priority: number;
    trial_status: string;
  }[];
  risks: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  profileForm: React.ReactNode;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("profile");
  const [tabStripBusy, setTabStripBusy] = useState(false);
  const [actType, setActType] = useState("note");
  const [actNotes, setActNotes] = useState("");
  const [supplyDocType, setSupplyDocType] = useState("aadhaar");
  const [supplyUploadOpen, setSupplyUploadOpen] = useState(false);
  const [referenceUpload, setReferenceUpload] = useState<{
    referenceId: string;
    referenceName: string;
    docType: string;
  } | null>(null);

  // Optimistic lists — prepend new items immediately, router.refresh() syncs after
  const [activities, setActivities] = useState(activitiesProp);
  const [references, setReferences] = useState(referencesProp);
  const [risks, setRisks] = useState(risksProp);
  const [documents, setDocuments] = useState(documentsProp);
  const [referenceDocuments, setReferenceDocuments] = useState(referenceDocumentsProp);
  const hasAadhaar = documents.some((d) => d.doc_type === "aadhaar");
  const hasSmartCard = documents.some((d) => d.doc_type === "smart_card");

  // Keep local lists in sync when parent props update (after router.refresh)
  useEffect(() => setActivities(activitiesProp), [activitiesProp]);
  useEffect(() => setReferences(referencesProp), [referencesProp]);
  useEffect(() => setRisks(risksProp), [risksProp]);
  useEffect(() => setDocuments(documentsProp), [documentsProp]);
  useEffect(() => setReferenceDocuments(referenceDocumentsProp), [referenceDocumentsProp]);

  const selectTab = useCallback((v: string) => {
    setActiveTab((cur) => {
      if (cur === v) return cur;
      setTabStripBusy(true);
      window.setTimeout(() => setTabStripBusy(false), 320);
      return v;
    });
  }, []);

  async function submitActivity(e: React.FormEvent) {
    e.preventDefault();
    const r = await addSupplyActivity(supplyId, actType, actNotes);
    if (r.error) toast.error(r.error);
    else {
      toast.success("Activity logged");
      // Show immediately
      setActivities((prev) => [
        {
          id: crypto.randomUUID(),
          activity_type: actType,
          notes: actNotes || null,
          created_at: new Date().toISOString(),
          created_by: null,
        },
        ...prev,
      ]);
      setActNotes("");
      refreshAfterMutation(router);
    }
  }

  return (
    <div className="flex flex-col md:flex-row md:items-start gap-0 md:gap-6">
      {/* Vertical nav — outside Tabs so sticky works reliably */}
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
              onClick={() => selectTab(value)}
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

      {/* Main content — Tabs only manages show/hide */}
      <Tabs value={activeTab} onValueChange={selectTab} className="relative flex-1 min-w-0">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {tabStripBusy && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 top-0 z-30 h-1 overflow-hidden rounded-full bg-muted shadow-sm"
          >
            <div className="h-full w-full animate-pulse bg-accent shadow-[0_0_8px_hsl(var(--accent))]" />
          </div>
        )}
        <TabsContent value="profile" className="mt-0 flex-1 min-h-0 space-y-4">
          {profileForm}
        </TabsContent>

        <TabsContent value="assigned" className="mt-0 flex-1 min-h-0 space-y-4">
          <Card className="w-full border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-lg">Customers assigned to this supply</CardTitle>
              <p className="text-xs text-muted-foreground font-normal">
                Read-only. Assignments are made from the lead when it is converted.
              </p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {assignedLeads.map((l) => (
                <div
                  key={l.lead_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/leads/${l.lead_id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {l.name}
                    </Link>
                    <span className="text-muted-foreground"> · {l.phone}</span>
                    <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">{l.status.replace(/_/g, " ")}</span>
                      {l.trail_number != null && (
                        <span className="font-mono">Lead ID {formatTrailId(l.trail_number)}</span>
                      )}
                      <span>
                        P{l.priority} · {l.trial_status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/leads/${l.lead_id}`}
                    className="shrink-0 text-xs text-primary hover:underline"
                  >
                    Open lead
                  </Link>
                </div>
              ))}
              {!assignedLeads.length && (
                <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-3 text-muted-foreground">
                  No customers assigned yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-0 flex flex-1 flex-col gap-4">
          <Card className="w-full border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-lg">Verification requirement</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <button
                type="button"
                className={cn("rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted", hasAadhaar ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700")}
                onClick={() => {
                  setSupplyDocType("aadhaar");
                  setSupplyUploadOpen(true);
                }}
              >
                Aadhaar card {hasAadhaar ? "uploaded" : "required"}
              </button>
              <button
                type="button"
                className={cn("rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted", hasSmartCard ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700")}
                onClick={() => {
                  setSupplyDocType("smart_card");
                  setSupplyUploadOpen(true);
                }}
              >
                Smart card {hasSmartCard ? "uploaded" : "required"}
              </button>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                When both files are present, the supply profile is auto-marked verified unless an admin has locked verification.
              </p>
            </CardContent>
          </Card>
          <Card className="w-full border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Upload document</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="secondary"
                className="w-fit"
                onClick={() => {
                  setSupplyDocType("other");
                  setSupplyUploadOpen(true);
                }}
              >
                <Upload className="size-4" />
                Upload another document
              </Button>
            </CardContent>
          </Card>
          <DocumentUploadDialog
            title={`Upload ${documentTypeLabel(supplyDocType)}`}
            description="Choose the file and upload it here. Aadhaar card plus Smart card will auto-verify this supply unless admin override is locked."
            open={supplyUploadOpen}
            onOpenChange={setSupplyUploadOpen}
            docType={supplyDocType}
            setDocType={setSupplyDocType}
            options={SUPPLY_DOCUMENT_TYPES}
            hiddenFields={{ supply_id: supplyId }}
            onSubmit={async (fd, context) => {
              const r = await uploadSupplyDocument(fd);
              if (r.error) {
                toast.error(r.error);
                return false;
              }
              toast.success("Uploaded");
              if (context.fileName) {
                setDocuments((prev) => [
                  {
                    id: crypto.randomUUID(),
                    doc_type: context.docType,
                    file_name: context.fileName,
                    storage_path: "",
                    created_at: new Date().toISOString(),
                  },
                  ...prev,
                ]);
              }
              refreshAfterMutation(router);
              return true;
            }}
          />
          <div className="w-full flex-1 rounded-xl border border-border/80 bg-card p-4 shadow-sm md:p-6">
            <h3 className="mb-3 font-medium">Uploaded files</h3>
            <ul className="space-y-2 text-sm">
              {documents.map((d) => (
                <li key={String(d.id)} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {documentTypeLabel(String(d.doc_type))} — {String(d.file_name)}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const path = String(d.storage_path);
                      const res = await getSignedCrmDocUrl(path);
                      if ("error" in res && res.error) toast.error(res.error);
                      else if ("url" in res && res.url) window.open(res.url, "_blank");
                    }}
                  >
                    Open
                  </Button>
                </li>
              ))}
              {!documents.length && <li className="text-muted-foreground">No documents yet.</li>}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-0 flex flex-1 flex-col gap-4">
          <Card className="w-full border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Add activity</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitActivity} className="grid w-full gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label required>Type</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={actType}
                    onChange={(e) => setActType(e.target.value)}
                  >
                    <option value="assigned">Assigned to customer</option>
                    <option value="trial_completed">Trial completed</option>
                    <option value="service_completed">Service completed</option>
                    <option value="complaint">Customer complaint</option>
                    <option value="no_response">No response</option>
                    <option value="left_midway">Left service midway</option>
                    <option value="blacklisted">Blacklisted issue</option>
                    <option value="positive_feedback">Positive feedback</option>
                    <option value="note">Note</option>
                  </select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="act_notes">Notes</Label>
                  <Textarea
                    id="act_notes"
                    value={actNotes}
                    onChange={(e) => setActNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-fit bg-accent text-accent-foreground">
                  Log activity
                </Button>
              </form>
            </CardContent>
          </Card>
          <div className="w-full flex-1 space-y-3">
            {activities.map((a) => (
              <div key={a.id} className="rounded-lg border border-border/80 bg-card p-3 text-sm shadow-sm">
                <div className="flex justify-between gap-2 text-muted-foreground">
                  <span className="font-medium capitalize text-foreground">
                    {a.activity_type.replace(/_/g, " ")}
                  </span>
                  <span>{format(new Date(a.created_at), "dd MMM yyyy, HH:mm")}</span>
                </div>
                {a.notes && <p className="mt-2 whitespace-pre-wrap">{a.notes}</p>}
              </div>
            ))}
            {!activities.length && <p className="text-muted-foreground">No activity yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="references" className="mt-0 flex flex-1 flex-col gap-4">
          <Card className="w-full border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Add reference</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid w-full gap-4 md:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const fd = new FormData(form);
                  fd.set("supply_id", supplyId);
                  const refName = String(fd.get("ref_name") || "");
                  const relationship = String(fd.get("relationship") || "");
	                  const phone = String(fd.get("ref_phone") || "");
	                  const notes = String(fd.get("ref_notes") || "");
	                  const r = await addSupplyReference(fd);
	                  if (r.error) toast.error(r.error);
	                  else {
	                    toast.success("Reference added");
                      const refId = "id" in r ? r.id : crypto.randomUUID();
                      const verificationStatus =
                        "verificationStatus" in r ? r.verificationStatus : "pending";
	                    setReferences((prev) => [
	                      {
	                        id: refId,
	                        ref_name: refName,
	                        relationship,
	                        phone,
	                        notes,
                          verification_status: verificationStatus,
	                        created_at: new Date().toISOString(),
	                      },
	                      ...prev,
	                    ]);
                      const uploadedDocs = "documents" in r ? r.documents ?? [] : [];
                      if (uploadedDocs.length > 0) {
                        setReferenceDocuments((prev) => [...uploadedDocs, ...prev]);
                      }
	                    form.reset();
	                    refreshAfterMutation(router);
	                  }
                }}
              >
                <input type="hidden" name="supply_id" value={supplyId} />
                <div className="space-y-2">
                  <Label htmlFor="ref_name" required>Name</Label>
                  <Input id="ref_name" name="ref_name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relationship">Relationship</Label>
                  <Input id="relationship" name="relationship" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ref_phone">Phone</Label>
                  <Input id="ref_phone" name="ref_phone" />
                </div>
	                <div className="md:col-span-2 space-y-2">
	                  <Label htmlFor="ref_notes">Notes</Label>
	                  <Textarea id="ref_notes" name="ref_notes" rows={2} />
	                </div>
                  <div className="space-y-2">
                    <Label htmlFor="ref_aadhaar_file">Aadhaar document</Label>
                    <Input id="ref_aadhaar_file" name="aadhaar_file" type="file" accept=".pdf,.jpg,.jpeg,.png" />
                    <p className="text-xs text-muted-foreground">Optional now. Required for auto verification.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ref_smart_card_file">Smart card document</Label>
                    <Input id="ref_smart_card_file" name="smart_card_file" type="file" accept=".pdf,.jpg,.jpeg,.png" />
                    <p className="text-xs text-muted-foreground">Optional now. Required for auto verification.</p>
                  </div>
	                <Button type="submit" className="w-fit bg-accent text-accent-foreground">
	                  Save reference
                </Button>
              </form>
            </CardContent>
          </Card>
          <ul className="w-full flex-1 space-y-2 text-sm">
            {references.map((r) => {
              const vs = String(r.verification_status ?? "pending");
              const refId = String(r.id);
              const rdocs = referenceDocuments.filter((d) => String(d.reference_id) === refId);
              const refHasAadhaar = rdocs.some((d) => d.doc_type === "aadhaar");
              const refHasSmartCard = rdocs.some((d) => d.doc_type === "smart_card");
              return (
                <li key={refId} className="rounded-lg border border-border/80 bg-card p-3 shadow-sm space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <strong>{String(r.ref_name)}</strong>
                      {r.relationship ? <span className="text-muted-foreground"> · {String(r.relationship)}</span> : null}
                      {r.phone ? <span className="text-muted-foreground"> · {String(r.phone)}</span> : null}
                      {r.notes ? <div className="mt-1 text-muted-foreground">{String(r.notes)}</div> : null}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "rounded border px-2 py-1 text-xs font-medium capitalize",
                          vs === "verified"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-amber-300 bg-amber-50 text-amber-700"
                        )}
                      >
                        {vs.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
	                  <div className="border-t border-border/60 pt-3 space-y-2">
	                    <p className="text-xs font-medium text-muted-foreground">Documents for this reference</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left text-xs transition-colors hover:bg-muted",
                          refHasAadhaar
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        )}
                        onClick={() => {
                          setReferenceUpload({
                            referenceId: refId,
                            referenceName: String(r.ref_name ?? "reference"),
                            docType: "aadhaar",
                          });
                        }}
                      >
                        Aadhaar card {refHasAadhaar ? "uploaded" : "required"}
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left text-xs transition-colors hover:bg-muted",
                          refHasSmartCard
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        )}
                        onClick={() => {
                          setReferenceUpload({
                            referenceId: refId,
                            referenceName: String(r.ref_name ?? "reference"),
                            docType: "smart_card",
                          });
                        }}
                      >
                        Smart card {refHasSmartCard ? "uploaded" : "required"}
                      </button>
                    </div>
	                    <ul className="space-y-1">
                      {rdocs.map((d) => (
                        <li key={String(d.id)} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span>
                            {documentTypeLabel(String(d.doc_type))} — {String(d.file_name)}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={async () => {
                              const path = String(d.storage_path);
                              const res = await getSignedCrmDocUrl(path);
                              if ("error" in res && res.error) toast.error(res.error);
                              else if ("url" in res && res.url) window.open(res.url, "_blank");
                            }}
                          >
                            Open
                          </Button>
                        </li>
                      ))}
                      {!rdocs.length && (
                        <li className="text-xs text-muted-foreground">No files uploaded yet.</li>
                      )}
                    </ul>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-fit"
                      onClick={() =>
                        setReferenceUpload({
                          referenceId: refId,
                          referenceName: String(r.ref_name ?? "reference"),
                          docType: "other",
                        })
                      }
                    >
                      <Upload className="size-4" />
                      Upload to this reference
                    </Button>
                  </div>
                </li>
              );
            })}
            {!references.length && (
              <li className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 text-muted-foreground">
                No references yet — add one above.
              </li>
            )}
          </ul>
          <DocumentUploadDialog
            title={
              referenceUpload
                ? `Upload ${documentTypeLabel(referenceUpload.docType)}`
                : "Upload reference document"
            }
            description={
              referenceUpload
                ? `Add this file for ${referenceUpload.referenceName}. Aadhaar card plus Smart card will auto-verify the reference.`
                : undefined
            }
            open={!!referenceUpload}
            onOpenChange={(open) => {
              if (!open) setReferenceUpload(null);
            }}
            docType={referenceUpload?.docType ?? "aadhaar"}
            setDocType={(docType) =>
              setReferenceUpload((current) => current ? { ...current, docType } : current)
            }
            options={REFERENCE_DOCUMENT_TYPES}
            hiddenFields={{
              reference_id: referenceUpload?.referenceId ?? "",
              supply_id: supplyId,
            }}
            onSubmit={async (fd) => {
              const up = await uploadSupplyReferenceDocument(fd);
              if (up.error) {
                toast.error(up.error);
                return false;
              }
              toast.success("Uploaded");
              if ("document" in up && up.document) {
                setReferenceDocuments((prev) => [
                  up.document as Record<string, unknown>,
                  ...prev,
                ]);
              }
              if ("verificationStatus" in up && referenceUpload?.referenceId) {
                setReferences((prev) =>
                  prev.map((ref) =>
                    String(ref.id) === referenceUpload.referenceId
                      ? { ...ref, verification_status: up.verificationStatus }
                      : ref
                  )
                );
              }
              refreshAfterMutation(router);
              return true;
            }}
          />
        </TabsContent>

        <TabsContent value="risk" className="mt-0 flex flex-1 flex-col gap-4">
          <Card className="w-full border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Add risk flag</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid w-full gap-4 md:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const fd = new FormData(form);
                  fd.set("supply_id", supplyId);
                  const category = String(fd.get("category") || "");
                  const notes = String(fd.get("notes") || "");
                  const r = await addSupplyRisk(fd);
                  if (r.error) toast.error(r.error);
                  else {
                    toast.success("Risk flag recorded");
                    setRisks((prev) => [
                      {
                        id: crypto.randomUUID(),
                        category,
                        notes,
                        created_at: new Date().toISOString(),
                      },
                      ...prev,
                    ]);
                    form.reset();
                    refreshAfterMutation(router);
                  }
                }}
              >
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="category" required>Category</Label>
                  <select
                    id="category"
                    name="category"
                    required
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="no_calls">Not picking calls</option>
                    <option value="salary_issues">Salary issues</option>
                    <option value="unprofessional">Unprofessional behavior</option>
                    <option value="fake_info">Fake information</option>
                    <option value="absconding">Absconding</option>
                    <option value="reliability">Reliability concerns</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="risk_notes">Notes</Label>
                  <Textarea id="risk_notes" name="notes" rows={3} />
                </div>
                <Button type="submit" variant="destructive" className="w-fit">
                  Add flag
                </Button>
              </form>
            </CardContent>
          </Card>
          <ul className="w-full flex-1 space-y-2 text-sm">
            {risks.map((r) => {
              const resolved = Boolean(r.resolved_at);
              return (
                <li
                  key={String(r.id)}
                  className={`rounded-lg border p-3 shadow-sm ${resolved ? "border-border/60 bg-muted/20 opacity-60" : "border-destructive/30 bg-destructive/5"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <strong className="capitalize">{String(r.category).replace(/_/g, " ")}</strong>
                      {resolved && <span className="ml-2 text-xs text-muted-foreground">(resolved)</span>}
                      {r.notes ? <div className="mt-1 text-muted-foreground">{String(r.notes)}</div> : null}
                    </div>
                    {!resolved && (
                      <button
                        type="button"
                        className="shrink-0 text-xs text-muted-foreground hover:text-foreground border border-border/60 rounded px-2 py-1 transition-colors"
                        onClick={async () => {
                          const res = await resolveSupplyRisk(String(r.id), supplyId);
                          if (res.error) toast.error(res.error);
                          else {
                            toast.success("Risk resolved");
                            setRisks((prev) =>
                              prev.map((risk) =>
                                risk.id === r.id ? { ...risk, resolved_at: new Date().toISOString() } : risk
                              )
                            );
                            refreshAfterMutation(router);
                          }
                        }}
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
            {!risks.length && (
              <li className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 text-muted-foreground">
                No risk flags recorded.
              </li>
            )}
          </ul>
        </TabsContent>
      </div>
      </Tabs>
    </div>
  );
}
