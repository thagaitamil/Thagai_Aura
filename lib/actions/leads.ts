"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { canWriteLeads, getSessionProfile } from "@/lib/auth/session";

const leadBase = z.object({
  name: z.string().min(1).max(300),
  phone: z.string().min(5).max(32),
  alt_phone: z.string().max(32).optional().nullable(),
  area_free_text: z.string().max(2000).optional().nullable(),
  full_address: z.string().max(2000).optional().nullable(),
  requirement_type: z.enum(["caretaker", "nurse"]),
  gender_preference: z.enum(["male", "female", "any"]),
  service_duration: z.enum(["12h", "24h", "monthly"]),
  budget_min: z.string().optional().nullable(),
  budget_max: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  special_notes: z.string().max(5000).optional().nullable(),
  status: z.enum([
    "new_lead",
    "mql",
    "sql",
    "good_lead",
    "hot_lead",
    "converted",
    "closed_lost",
  ]),
  follow_up_required: z.boolean().optional(),
  follow_up_at: z.string().optional().nullable(),
  follow_up_notes: z.string().max(2000).optional().nullable(),
});

function parseNum(v: string | null | undefined) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function assertLeadWriteAccess(
  supabase: ReturnType<typeof createClient>,
  profile: NonNullable<Awaited<ReturnType<typeof getSessionProfile>>["profile"]>,
  leadId: string
) {
  if (profile.role === "admin" || profile.role === "operations") return true;
  if (profile.role === "viewer") return false;
  const { data: lead } = await supabase
    .from("leads")
    .select("created_by")
    .eq("id", leadId)
    .maybeSingle();
  if (lead?.created_by === profile.id) return true;
  const { data } = await supabase
    .from("lead_assignments")
    .select("id")
    .eq("lead_id", leadId)
    .eq("assigned_to", profile.id)
    .maybeSingle();
  return !!data;
}

export async function createLead(formData: FormData) {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteLeads(profile.role)) {
    return { error: "You do not have permission to create leads." };
  }
  const raw = {
    name: formData.get("name"),
    phone: formData.get("phone"),
    alt_phone: formData.get("alt_phone") || null,
    area_free_text: formData.get("area_free_text") || null,
    full_address: formData.get("full_address") || null,
    requirement_type: formData.get("requirement_type"),
    gender_preference: formData.get("gender_preference"),
    service_duration: formData.get("service_duration"),
    budget_min: formData.get("budget_min"),
    budget_max: formData.get("budget_max"),
    start_date: formData.get("start_date") || null,
    special_notes: formData.get("special_notes") || null,
    status: formData.get("status"),
    follow_up_required: formData.get("follow_up_required") === "on",
    follow_up_at: formData.get("follow_up_at") || null,
    follow_up_notes: formData.get("follow_up_notes") || null,
  };
  const parsed = leadBase.safeParse(raw);
  if (!parsed.success) return { error: "Validation failed." };
  const supabase = createClient();
  const convertedAtValue =
    parsed.data.status === "converted" ? new Date().toISOString() : null;
  const { data, error } = await supabase
    .from("leads")
    .insert({
      name: parsed.data.name,
      phone: parsed.data.phone,
      alt_phone: parsed.data.alt_phone,
      area_free_text: parsed.data.area_free_text,
      full_address: parsed.data.full_address,
      requirement_type: parsed.data.requirement_type,
      gender_preference: parsed.data.gender_preference,
      service_duration: parsed.data.service_duration,
      budget_min: parseNum(parsed.data.budget_min ?? undefined),
      budget_max: parseNum(parsed.data.budget_max ?? undefined),
      start_date: parsed.data.start_date || null,
      special_notes: parsed.data.special_notes,
      status: parsed.data.status,
      converted_at: convertedAtValue,
      follow_up_required: parsed.data.follow_up_required ?? false,
      follow_up_at: parsed.data.follow_up_at || null,
      follow_up_notes: parsed.data.follow_up_notes,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const areaIds = formData.getAll("area_option_id").filter(Boolean) as string[];
  if (areaIds.length && data?.id) {
    await supabase.from("lead_area_tags").insert(
      areaIds.map((area_option_id) => ({ lead_id: data.id, area_option_id }))
    );
  }
  const assignTo = formData.get("assigned_to");
  if (assignTo && typeof assignTo === "string" && assignTo.length > 0 && data?.id) {
    await supabase.from("lead_assignments").insert({
      lead_id: data.id,
      assigned_to: assignTo,
      assigned_by: profile.id,
    });
  }
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { success: true as const, id: data!.id };
}

export async function updateLead(id: string, formData: FormData) {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteLeads(profile.role)) return { error: "Unauthorized" };
  const supabase = createClient();
  const ok = await assertLeadWriteAccess(supabase, profile, id);
  if (!ok) return { error: "You cannot edit this lead." };
  const raw = {
    name: formData.get("name"),
    phone: formData.get("phone"),
    alt_phone: formData.get("alt_phone") || null,
    area_free_text: formData.get("area_free_text") || null,
    full_address: formData.get("full_address") || null,
    requirement_type: formData.get("requirement_type"),
    gender_preference: formData.get("gender_preference"),
    service_duration: formData.get("service_duration"),
    budget_min: formData.get("budget_min"),
    budget_max: formData.get("budget_max"),
    start_date: formData.get("start_date") || null,
    special_notes: formData.get("special_notes") || null,
    status: formData.get("status"),
    follow_up_required: formData.get("follow_up_required") === "on",
    follow_up_at: formData.get("follow_up_at") || null,
    follow_up_notes: formData.get("follow_up_notes") || null,
  };
  const parsed = leadBase.safeParse(raw);
  if (!parsed.success) return { error: "Validation failed." };
  const convertedAtValue =
    parsed.data.status === "converted" ? new Date().toISOString() : null;
  const { error } = await supabase
    .from("leads")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone,
      alt_phone: parsed.data.alt_phone,
      area_free_text: parsed.data.area_free_text,
      full_address: parsed.data.full_address,
      requirement_type: parsed.data.requirement_type,
      gender_preference: parsed.data.gender_preference,
      service_duration: parsed.data.service_duration,
      budget_min: parseNum(parsed.data.budget_min ?? undefined),
      budget_max: parseNum(parsed.data.budget_max ?? undefined),
      start_date: parsed.data.start_date || null,
      special_notes: parsed.data.special_notes,
      status: parsed.data.status,
      converted_at: convertedAtValue,
      follow_up_required: parsed.data.follow_up_required ?? false,
      follow_up_at: parsed.data.follow_up_at || null,
      follow_up_notes: parsed.data.follow_up_notes,
    })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) return { error: error.message };
  await supabase.from("lead_area_tags").delete().eq("lead_id", id);
  const areaIds = formData.getAll("area_option_id").filter(Boolean) as string[];
  if (areaIds.length) {
    await supabase.from("lead_area_tags").insert(
      areaIds.map((area_option_id) => ({ lead_id: id, area_option_id }))
    );
  }
  const assignTo = formData.get("assigned_to");
  if (assignTo && typeof assignTo === "string" && assignTo.length > 0) {
    await supabase.from("lead_assignments").delete().eq("lead_id", id);
    await supabase.from("lead_assignments").insert({
      lead_id: id,
      assigned_to: assignTo,
      assigned_by: profile.id,
    });
  } else {
    await supabase.from("lead_assignments").delete().eq("lead_id", id);
  }
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function addLeadActivity(
  leadId: string,
  activity_type: string,
  notes: string
) {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteLeads(profile.role)) return { error: "Unauthorized" };
  const supabase = createClient();
  const ok = await assertLeadWriteAccess(supabase, profile, leadId);
  if (!ok) return { error: "Forbidden" };
  const { error } = await supabase.from("lead_activities").insert({
    lead_id: leadId,
    activity_type,
    notes,
    created_by: profile.id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

export async function saveLeadMappings(
  leadId: string,
  p1: string,
  p2: string,
  p3: string
) {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteLeads(profile.role)) return { error: "Unauthorized" };
  const supabase = createClient();
  const ok = await assertLeadWriteAccess(supabase, profile, leadId);
  if (!ok) return { error: "Forbidden" };
  await supabase.from("supply_mapping").delete().eq("lead_id", leadId);
  const rows: {
    lead_id: string;
    supply_id: string;
    priority: number;
    trial_status: string;
    created_by: string;
  }[] = [];
  const add = (priority: number, supplyId: string) => {
    if (!supplyId) return;
    rows.push({
      lead_id: leadId,
      supply_id: supplyId,
      priority,
      trial_status: "suggested",
      created_by: profile.id,
    });
  };
  add(1, p1);
  add(2, p2);
  add(3, p3);
  // Deduplicate: keep first occurrence of each supply_id to avoid unique constraint
  const seen = new Set<string>();
  const dedupedRows = rows.filter((r) => {
    if (seen.has(r.supply_id)) return false;
    seen.add(r.supply_id);
    return true;
  });
  if (dedupedRows.length) {
    const { error } = await supabase.from("supply_mapping").insert(dedupedRows);
    if (error) return { error: error.message };
  }
  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

export async function updateMappingTrial(
  mappingId: string,
  leadId: string,
  trial_status: string
) {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteLeads(profile.role)) return { error: "Unauthorized" };
  const supabase = createClient();
  const ok = await assertLeadWriteAccess(supabase, profile, leadId);
  if (!ok) return { error: "Forbidden" };
  const { error } = await supabase
    .from("supply_mapping")
    .update({ trial_status, updated_at: new Date().toISOString() })
    .eq("id", mappingId);
  if (error) return { error: error.message };
  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

export async function setMappingReserved(
  mappingId: string,
  leadId: string,
  is_reserved: boolean
) {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteLeads(profile.role)) return { error: "Unauthorized" };
  const supabase = createClient();
  const ok = await assertLeadWriteAccess(supabase, profile, leadId);
  if (!ok) return { error: "Forbidden" };
  const { error } = await supabase
    .from("supply_mapping")
    .update({ is_reserved, updated_at: new Date().toISOString() })
    .eq("id", mappingId);
  if (error) return { error: error.message };
  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

export async function uploadLeadDocument(formData: FormData) {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteLeads(profile.role)) return { error: "Unauthorized" };
  const leadId = String(formData.get("lead_id"));
  const supabase = createClient();
  const ok = await assertLeadWriteAccess(supabase, profile, leadId);
  if (!ok) return { error: "Forbidden" };
  const docType = String(formData.get("doc_type"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file." };
  }
  if (file.size > 10 * 1024 * 1024) return { error: "Max 10 MB." };
  const path = `leads/${leadId}/${crypto.randomUUID()}_${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error: upErr } = await supabase.storage
    .from("crm-docs")
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (upErr) return { error: upErr.message };
  const { error } = await supabase.from("lead_documents").insert({
    lead_id: leadId,
    doc_type: docType,
    file_name: file.name,
    storage_path: path,
    mime_type: file.type,
    size_bytes: file.size,
    uploaded_by: profile.id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

export async function addLeadFollowUpRow(leadId: string, formData: FormData) {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteLeads(profile.role)) return { error: "Unauthorized" };
  const supabase = createClient();
  const ok = await assertLeadWriteAccess(supabase, profile, leadId);
  if (!ok) return { error: "Forbidden" };
  const dueRaw = String(formData.get("due_at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!dueRaw) return { error: "Pick a follow-up date and time." };
  const dueAt = new Date(dueRaw);
  if (Number.isNaN(dueAt.getTime())) return { error: "Invalid date." };
  const dueIso = dueAt.toISOString();
  const { error: insErr } = await supabase.from("lead_follow_ups").insert({
    lead_id: leadId,
    due_at: dueIso,
    notes: notes || null,
    outcome: "pending",
    created_by: profile.id,
  });
  if (insErr) return { error: insErr.message };
  await supabase
    .from("leads")
    .update({
      follow_up_required: true,
      follow_up_at: dueIso,
      follow_up_notes: notes || null,
    })
    .eq("id", leadId);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function setLeadFollowUpOutcome(
  followUpId: string,
  leadId: string,
  outcome: "completed" | "missed" | "rescheduled" | "cancelled"
) {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteLeads(profile.role)) return { error: "Unauthorized" };
  const supabase = createClient();
  const ok = await assertLeadWriteAccess(supabase, profile, leadId);
  if (!ok) return { error: "Forbidden" };
  const { error } = await supabase
    .from("lead_follow_ups")
    .update({
      outcome,
      completed_at: new Date().toISOString(),
    })
    .eq("id", followUpId)
    .eq("lead_id", leadId);
  if (error) return { error: error.message };
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { success: true as const };
}
