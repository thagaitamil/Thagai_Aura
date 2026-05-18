"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { canWriteSupply, getSessionProfile } from "@/lib/auth/session";

const supplyBase = z.object({
  full_name: z.string().min(1).max(300),
  phone: z.string().min(5).max(32),
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
  verification_status: z.enum(["verified", "pending", "not_verified"]),
  verification_notes: z.string().max(5000).optional().nullable(),
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
    verification_status: formData.get("verification_status"),
    verification_notes: formData.get("verification_notes") || null,
    status: formData.get("status"),
    is_blacklisted: formData.get("is_blacklisted") === "on",
    area_free_text: formData.get("area_free_text") || null,
  };
  const parsed = supplyBase.safeParse(raw);
  if (!parsed.success) {
    return { error: "Please fix validation errors in the form." };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("supply_profiles")
    .insert({
      full_name: parsed.data.full_name,
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
      verification_status: parsed.data.verification_status,
      verification_notes: parsed.data.verification_notes,
      status: parsed.data.status,
      is_blacklisted: parsed.data.is_blacklisted ?? false,
      area_free_text: parsed.data.area_free_text,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const areaIds = formData.getAll("area_option_id").filter(Boolean) as string[];
  if (areaIds.length && data?.id) {
    const rows = areaIds.map((area_option_id) => ({
      supply_id: data.id,
      area_option_id,
    }));
    const { error: tagErr } = await supabase.from("supply_area_tags").insert(rows);
    if (tagErr) return { error: tagErr.message };
  }
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
    verification_status: formData.get("verification_status"),
    verification_notes: formData.get("verification_notes") || null,
    status: formData.get("status"),
    is_blacklisted: formData.get("is_blacklisted") === "on",
    area_free_text: formData.get("area_free_text") || null,
  };
  const parsed = supplyBase.safeParse(raw);
  if (!parsed.success) return { error: "Validation failed." };
  const supabase = createClient();
  const { error } = await supabase
    .from("supply_profiles")
    .update({
      full_name: parsed.data.full_name,
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
      verification_status: parsed.data.verification_status,
      verification_notes: parsed.data.verification_notes,
      status: parsed.data.status,
      is_blacklisted: parsed.data.is_blacklisted ?? false,
      area_free_text: parsed.data.area_free_text,
    })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) return { error: error.message };
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
  if (error) return { error: error.message };
  revalidatePath(`/supply/${supplyId}`);
  return { success: true };
}

export async function addSupplyReference(formData: FormData) {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteSupply(profile.role)) return { error: "Unauthorized" };
  const supplyId = String(formData.get("supply_id"));
  const supabase = createClient();
  const { error } = await supabase.from("supply_references").insert({
    supply_id: supplyId,
    ref_name: String(formData.get("ref_name")),
    relationship: String(formData.get("relationship") || ""),
    phone: String(formData.get("ref_phone") || ""),
    verification_status: String(formData.get("ref_verification") || "pending"),
    notes: String(formData.get("ref_notes") || ""),
    created_by: profile.id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/supply/${supplyId}`);
  return { success: true };
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
  if (error) return { error: error.message };
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
  if (error) return { error: error.message };
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
  if (error) return { error: error.message };
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
  if (upErr) return { error: upErr.message };
  const { error } = await supabase.from("supply_documents").insert({
    supply_id: supplyId,
    doc_type: docType,
    file_name: file.name,
    storage_path: path,
    mime_type: file.type,
    size_bytes: file.size,
    uploaded_by: profile.id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/supply/${supplyId}`);
  return { success: true };
}
