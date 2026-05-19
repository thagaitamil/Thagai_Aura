"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";

const areaSchema = z.object({
  label: z.string().min(1).max(200),
});

const revalidateAreaConsumers = () => {
  revalidatePath("/admin/areas");
  revalidatePath("/supply/new");
  revalidatePath("/supply");
  revalidatePath("/leads/new");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
};

/** Inline create from searchable area combobox (staff who can edit leads or supply). */
export async function createAreaQuick(rawLabel: string) {
  const { profile } = await getSessionProfile();
  if (!profile) return { error: "Unauthorized" };
  const can =
    profile.role === "admin" ||
    profile.role === "operations" ||
    profile.role === "sales";
  if (!can) return { error: "You do not have permission to add locations." };
  const label = rawLabel.trim();
  if (label.length < 2) return { error: "Enter at least 2 characters." };
  if (label.length > 200) return { error: "Label too long." };
  const supabase = createClient();
  const { data: dup } = await supabase
    .from("area_options")
    .select("id")
    .ilike("label", label)
    .maybeSingle();
  if (dup?.id) return { success: true as const, id: dup.id as string };
  const { data, error } = await supabase
    .from("area_options")
    .insert({ label, created_by: profile.id, sort_order: 0, is_active: true })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidateAreaConsumers();
  return { success: true as const, id: data!.id as string };
}

export async function createAreaOption(formData: FormData) {
  const { profile } = await getSessionProfile();
  if (!profile || profile.role !== "admin") {
    return { error: "Only admins can manage area tags." };
  }
  const parsed = areaSchema.safeParse({ label: formData.get("label") });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors.label?.[0] ?? "Invalid label" };
  }
  const supabase = createClient();
  const { error } = await supabase.from("area_options").insert({
    label: parsed.data.label.trim(),
    created_by: profile.id,
  });
  if (error) return { error: error.message };
  revalidateAreaConsumers();
  return { success: true };
}

export async function toggleAreaOption(id: string, is_active: boolean) {
  const { profile } = await getSessionProfile();
  if (!profile || profile.role !== "admin") {
    return { error: "Unauthorized" };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("area_options")
    .update({ is_active })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/areas");
  return { success: true };
}
