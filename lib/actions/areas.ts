"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";

const areaSchema = z.object({
  label: z.string().min(1).max(200),
});

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
  revalidatePath("/admin/areas");
  revalidatePath("/supply/new");
  revalidatePath("/leads/new");
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
