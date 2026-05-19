"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { canWriteSupply, getSessionProfile, isAdmin } from "@/lib/auth/session";
import { recomputeSupplyVerificationFromDocuments } from "@/lib/verification-sync";
import { friendlyActionError } from "@/lib/actions/error-messages";
import { titleCaseName } from "@/lib/text-format";

const aadhaarSchema = z
  .string()
  .trim()
  .regex(/^\d{12}$/, "Enter a valid 12-digit Aadhaar number");

const supplyCore = z.object({
  full_name: z.string().trim().min(1, "Enter the full name.").max(300, "Full name is too long."),
  phone: z.string().trim().min(5, "Enter a valid phone number.").max(32, "Phone number is too long."),
  alt_phone: z.string().max(32).optional().nullable(),
  address: z.string().max(2000).optional().nullable(),
  district: z.string().max(200).optional().nullable(),
  state: z.string().max(200).optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  age: z.number().int().min(16).max(100).optional().nullable(),
  type: z.enum(["caretaker", "nurse"]),
  availability: z.enum(["12h", "24h", "monthly", "part_time"]),
  service_scope: z.enum(["chennai_all", "chennai_areas", "outside_chennai"]),
  languages: z.string().max(500).optional().nullable(),
  salary_12h: z.string().optional().nullable(),
  salary_24h: z.string().optional().nullable(),
  salary_monthly: z.string().optional().nullable(),
  aadhaar_number: aadhaarSchema,
  status: z.enum([
    "available",
    "on_duty",
    "trial",
    "reserved",
    "temp_unavailable",
    "inactive",
  ]),
  is_blacklisted: z.boolean().default(false),
  area_free_text: z.string().max(2000).optional().nullable(),
});

const supplyVerificationForm = z.object({
  verification_status: z.enum(["verified", "pending", "not_verified"]),
  verification_notes: z.string().max(5000).optional().nullable(),
});

function parseNum(v: string | null | undefined) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function createSupply(formData: FormData) {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteSupply(profile.role)) {
    return { error: "You do not have permission to add supply." };
  }
  const raw = {
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    alt_phone: formData.get("alt_phone") || null,
    address: formData.get("address") || null,
    district: formData.get("district") || null,
    state: formData.get("state") || null,
    gender: formData.get("gender") || null,
    age: (() => {
      const v = formData.get("age");
      if (v === "" || v == null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    })(),
    type: formData.get("type"),
    availability: formData.get("availability"),
    service_scope: formData.get("service_scope"),
    languages: formData.get("languages") || null,
    salary_12h: formData.get("salary_12h"),
    salary_24h: formData.get("salary_24h"),
    salary_monthly: formData.get("salary_monthly"),
    aadhaar_number: formData.get("aadhaar_number"),
    status: formData.get("status"),
    is_blacklisted: formData.get("is_blacklisted") === "on",
    area_free_text: formData.get("area_free_text") || null,
  };
  const parsed = supplyCore.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please fix validation errors in the form." };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("supply_profiles")
    .insert({
      full_name: titleCaseName(parsed.data.full_name),
      phone: parsed.data.phone,
      alt_phone: parsed.data.alt_phone,
      address: parsed.data.address,
      district: parsed.data.district,
      state: parsed.data.state,
      gender: parsed.data.gender,
      age: parsed.data.age,
      type: parsed.data.type,
      availability: parsed.data.availability,
      service_scope: parsed.data.service_scope,
      languages: parsed.data.languages,
      salary_12h: parseNum(parsed.data.salary_12h ?? undefined),
      salary_24h: parseNum(parsed.data.salary_24h ?? undefined),
      salary_monthly: parseNum(parsed.data.salary_monthly ?? undefined),
      aadhaar_number: parsed.data.aadhaar_number,
      verification_status: "pending",
      verification_manual_override: false,
      verification_notes: null,
      status: parsed.data.status,
      is_blacklisted: parsed.data.is_blacklisted ?? false,
      area_free_text: parsed.data.area_free_text,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) return { error: friendlyActionError(error) };
  const areaIds = formData.getAll("area_option_id").filter(Boolean) as string[];
  if (areaIds.length && data?.id) {
    const rows = areaIds.map((area_option_id) => ({
      supply_id: data.id,
      area_option_id,
    }));
    const { error: tagErr } = await supabase.from("supply_area_tags").insert(rows);
    if (tagErr) return { error: friendlyActionError(tagErr) };
  }
  await recomputeSupplyVerificationFromDocuments(supabase, data!.id);
  revalidatePath("/supply");
  return { success: true as const, id: data!.id };
}

export async function updateSupply(id: string, formData: FormData) {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteSupply(profile.role)) {
    return { error: "Unauthorized" };
  }
  const raw = {
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    alt_phone: formData.get("alt_phone") || null,
    address: formData.get("address") || null,
    district: formData.get("district") || null,
    state: formData.get("state") || null,
    gender: formData.get("gender") || null,
    age: (() => {
      const v = formData.get("age");
      if (v === "" || v == null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    })(),
    type: formData.get("type"),
    availability: formData.get("availability"),
    service_scope: formData.get("service_scope"),
    languages: formData.get("languages") || null,
    salary_12h: formData.get("salary_12h"),
    salary_24h: formData.get("salary_24h"),
    salary_monthly: formData.get("salary_monthly"),
    aadhaar_number: formData.get("aadhaar_number"),
    status: formData.get("status"),
    is_blacklisted: formData.get("is_blacklisted") === "on",
    area_free_text: formData.get("area_free_text") || null,
  };
  const parsed = supplyCore.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please fix validation errors in the form." };
  }
  const supabase = createClient();

  const { data: cur } = await supabase
    .from("supply_profiles")
    .select("verification_status, verification_manual_override, verification_notes")
    .eq("id", id)
    .maybeSingle();

  let verification_status = (cur?.verification_status as string) ?? "pending";
  let verification_manual_override = !!(cur as { verification_manual_override?: boolean } | null)
    ?.verification_manual_override;
  let verification_notes =
    (cur as { verification_notes?: string | null } | null)?.verification_notes ?? null;

  if (isAdmin(profile.role)) {
    const vRaw = {
      verification_status: formData.get("verification_status"),
      verification_notes: formData.get("verification_notes") || null,
    };
    const vp = supplyVerificationForm.safeParse(vRaw);
    if (!vp.success) return { error: "Invalid verification fields." };
    verification_status = vp.data.verification_status;
    verification_notes = vp.data.verification_notes ?? null;
    const allowAuto = formData.get("allow_auto_verify") === "on";
    verification_manual_override = !allowAuto;
    if (verification_status === "not_verified") {
      verification_manual_override = true;
    }
  }

  const { error } = await supabase
    .from("supply_profiles")
    .update({
      full_name: titleCaseName(parsed.data.full_name),
      phone: parsed.data.phone,
      alt_phone: parsed.data.alt_phone,
      address: parsed.data.address,
      district: parsed.data.district,
      state: parsed.data.state,
      gender: parsed.data.gender,
      age: parsed.data.age,
      type: parsed.data.type,
      availability: parsed.data.availability,
      service_scope: parsed.data.service_scope,
      languages: parsed.data.languages,
      salary_12h: parseNum(parsed.data.salary_12h ?? undefined),
      salary_24h: parseNum(parsed.data.salary_24h ?? undefined),
      salary_monthly: parseNum(parsed.data.salary_monthly ?? undefined),
      aadhaar_number: parsed.data.aadhaar_number,
      verification_status,
      verification_manual_override,
      verification_notes,
      status: parsed.data.status,
      is_blacklisted: parsed.data.is_blacklisted ?? false,
      area_free_text: parsed.data.area_free_text,
    })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) return { error: friendlyActionError(error) };
  await recomputeSupplyVerificationFromDocuments(supabase, id);
  await supabase.from("supply_area_tags").delete().eq("supply_id", id);
  const areaIds = formData.getAll("area_option_id").filter(Boolean) as string[];
  if (areaIds.length) {
    await supabase.from("supply_area_tags").insert(
      areaIds.map((area_option_id) => ({ supply_id: id, area_option_id }))
    );
  }
  revalidatePath("/supply");
  revalidatePath(`/supply/${id}`);
  return { success: true as const };
}

export async function addSupplyActivity(
  supplyId: string,
  activity_type: string,
  notes: string
) {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteSupply(profile.role)) return { error: "Unauthorized" };
  const supabase = createClient();
  const { error } = await supabase.from("supply_activities").insert({
    supply_id: supplyId,
    activity_type,
    notes,
    created_by: profile.id,
  });
  if (error) return { error: friendlyActionError(error) };
  revalidatePath(`/supply/${supplyId}`);
  return { success: true };
}

export async function addSupplyReference(formData: FormData) {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteSupply(profile.role)) return { error: "Unauthorized" };
  const supplyId = String(formData.get("supply_id"));
  const supabase = createClient();
  const { data, error } = await supabase
    .from("supply_references")
    .insert({
      supply_id: supplyId,
      ref_name: String(formData.get("ref_name")),
      relationship: String(formData.get("relationship") || ""),
      phone: String(formData.get("ref_phone") || ""),
      verification_status: "pending",
      notes: String(formData.get("ref_notes") || ""),
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) return { error: friendlyActionError(error) };
  const referenceId = data.id as string;
  const uploadedDocuments = [];
  for (const [fieldName, docType] of [
    ["aadhaar_file", "aadhaar"],
    ["smart_card_file", "smart_card"],
  ] as const) {
    const file = formData.get(fieldName);
    if (!(file instanceof File) || file.size === 0) continue;
    const uploaded = await insertReferenceDocument(
      supabase,
      referenceId,
      docType,
      file,
      profile.id
    );
    if ("error" in uploaded) return { error: uploaded.error };
    uploadedDocuments.push(uploaded.document);
  }
  const verificationStatus = await recomputeReferenceVerificationFromDocuments(
    supabase,
    referenceId
  );
  revalidatePath(`/supply/${supplyId}`);
  return {
    success: true as const,
    id: referenceId,
    verificationStatus,
    documents: uploadedDocuments,
  };
}

export async function addSupplyRisk(formData: FormData) {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteSupply(profile.role)) return { error: "Unauthorized" };
  const supplyId = String(formData.get("supply_id"));
  const supabase = createClient();
  const { error } = await supabase.from("supply_risk_markers").insert({
    supply_id: supplyId,
    category: String(formData.get("category")),
    notes: String(formData.get("notes") || ""),
    created_by: profile.id,
  });
  if (error) return { error: friendlyActionError(error) };
  revalidatePath(`/supply/${supplyId}`);
  return { success: true };
}

export async function updateReferenceVerification(
  refId: string,
  supplyId: string,
  verificationStatus: "verified" | "pending" | "not_verified"
) {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteSupply(profile.role)) return { error: "Unauthorized" };
  const supabase = createClient();
  const { error } = await supabase
    .from("supply_references")
    .update({ verification_status: verificationStatus })
    .eq("id", refId);
  if (error) return { error: friendlyActionError(error) };
  revalidatePath(`/supply/${supplyId}`);
  return { success: true };
}

export async function resolveSupplyRisk(riskId: string, supplyId: string) {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteSupply(profile.role)) return { error: "Unauthorized" };
  const supabase = createClient();
  const { error } = await supabase
    .from("supply_risk_markers")
    .update({ resolved_at: new Date().toISOString(), resolved_by: profile.id })
    .eq("id", riskId);
  if (error) return { error: friendlyActionError(error) };
  revalidatePath(`/supply/${supplyId}`);
  return { success: true };
}

export async function uploadSupplyDocument(formData: FormData) {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteSupply(profile.role)) return { error: "Unauthorized" };
  const supplyId = String(formData.get("supply_id"));
  const docType = String(formData.get("doc_type"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { error: "Max file size is 10 MB." };
  }
  const supabase = createClient();
  const path = `supply/${supplyId}/${crypto.randomUUID()}_${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error: upErr } = await supabase.storage
    .from("crm-docs")
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (upErr) return { error: friendlyActionError(upErr) };
  const { error } = await supabase.from("supply_documents").insert({
    supply_id: supplyId,
    doc_type: docType,
    file_name: file.name,
    storage_path: path,
    mime_type: file.type,
    size_bytes: file.size,
    uploaded_by: profile.id,
  });
  if (error) return { error: friendlyActionError(error) };
  await recomputeSupplyVerificationFromDocuments(supabase, supplyId);
  revalidatePath(`/supply/${supplyId}`);
  return { success: true };
}

const refDocTypes = ["aadhaar", "photo", "medical", "smart_card", "other"] as const;

async function insertReferenceDocument(
  supabase: ReturnType<typeof createClient>,
  referenceId: string,
  docType: (typeof refDocTypes)[number],
  file: File,
  uploadedBy: string
) {
  if (file.size > 10 * 1024 * 1024) return { error: "Max file size is 10 MB." };
  const path = `supply_ref/${referenceId}/${crypto.randomUUID()}_${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error: upErr } = await supabase.storage
    .from("crm-docs")
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (upErr) return { error: friendlyActionError(upErr) };
  const { data, error } = await supabase
    .from("supply_reference_documents")
    .insert({
      reference_id: referenceId,
      doc_type: docType,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: uploadedBy,
    })
    .select("id, reference_id, doc_type, file_name, storage_path, created_at")
    .single();
  if (error) return { error: friendlyActionError(error) };
  return { document: data };
}

async function recomputeReferenceVerificationFromDocuments(
  supabase: ReturnType<typeof createClient>,
  referenceId: string
) {
  const { data: docs } = await supabase
    .from("supply_reference_documents")
    .select("doc_type")
    .eq("reference_id", referenceId);
  const types = new Set((docs ?? []).map((d) => d.doc_type as string));
  const next = types.has("aadhaar") && types.has("smart_card") ? "verified" : "pending";
  await supabase
    .from("supply_references")
    .update({ verification_status: next })
    .eq("id", referenceId);
  return next;
}

export async function uploadSupplyReferenceDocument(formData: FormData) {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteSupply(profile.role)) return { error: "Unauthorized" };
  const referenceId = String(formData.get("reference_id"));
  const supplyId = String(formData.get("supply_id"));
  const docType = String(formData.get("doc_type"));
  const file = formData.get("file");
  if (!refDocTypes.includes(docType as (typeof refDocTypes)[number])) {
    return { error: "Invalid document type." };
  }
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  const supabase = createClient();
  const uploaded = await insertReferenceDocument(
    supabase,
    referenceId,
    docType as (typeof refDocTypes)[number],
    file,
    profile.id
  );
  if ("error" in uploaded) return { error: uploaded.error };
  const verificationStatus = await recomputeReferenceVerificationFromDocuments(
    supabase,
    referenceId
  );
  revalidatePath(`/supply/${supplyId}`);
  return { success: true as const, document: uploaded.document, verificationStatus };
}
