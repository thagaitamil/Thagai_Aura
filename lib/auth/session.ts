import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getSessionProfile(): Promise<{
  userId: string;
  profile: Profile | null;
  /** Set when authenticated but portal access is blocked (see portal layout). */
  accessDenied?: "missing_profile" | "inactive_profile";
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { userId: "", profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, active, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return { userId: user.id, profile: null, accessDenied: "missing_profile" };
  }
  if (!profile.active) {
    return { userId: user.id, profile: null, accessDenied: "inactive_profile" };
  }

  return {
    userId: user.id,
    profile: profile as Profile,
  };
}

export function canWriteSupply(role: Profile["role"]) {
  return role === "admin" || role === "operations";
}

export function canWriteLeads(role: Profile["role"]) {
  return role === "admin" || role === "operations" || role === "sales";
}

export function isAdmin(role: Profile["role"]) {
  return role === "admin";
}
