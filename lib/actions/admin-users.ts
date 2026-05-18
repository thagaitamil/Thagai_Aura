"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getSessionProfile, isAdmin } from "@/lib/auth/session";

const inviteSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1).max(200),
  role: z.enum(["admin", "operations", "sales", "viewer"]),
});

export async function inviteTeamMember(formData: FormData) {
  const { profile } = await getSessionProfile();
  if (!profile || !isAdmin(profile.role)) {
    return { error: "Only admins can invite users." };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY is not set. Add it in Vercel / .env.local to enable user invites.",
    };
  }
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    full_name: formData.get("full_name"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: "Check all fields. Password must be at least 8 characters." };
  }
  const admin = createServiceClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.full_name,
      role: parsed.data.role,
    },
  });
  if (error) return { error: error.message };
  if (data.user) {
    await admin
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        role: parsed.data.role,
        email: parsed.data.email,
      })
      .eq("id", data.user.id);
  }
  revalidatePath("/admin/users");
  return { success: true };
}

export async function setUserActive(userId: string, active: boolean) {
  const { profile } = await getSessionProfile();
  if (!profile || !isAdmin(profile.role)) {
    return { error: "Unauthorized" };
  }
  if (userId === profile.id && !active) {
    return { error: "You cannot deactivate yourself." };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ active })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { success: true };
}
