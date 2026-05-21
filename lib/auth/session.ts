import { createClient } from "@/lib/supabase/server";
import { CACHE_TTL_SECONDS, cached } from "@/lib/cache/redis";
import { cacheTags } from "@/lib/cache/tags";
import type { Profile } from "@/lib/types";

export async function getSessionProfile(): Promise<{
  userId: string;
  profile: Profile | null;
  /** Set when authenticated but portal access is blocked (see portal layout). */
  accessDenied?: "missing_profile" | "inactive_profile";
}> {
  const supabase = createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;

  if (!userId) {
    return { userId: "", profile: null };
  }

  const profile = await cached({
    key: `auth:profile:${userId}`,
    tags: [cacheTags.profiles],
    ttlSeconds: CACHE_TTL_SECONDS,
    getFresh: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, active, created_at")
        .eq("id", userId)
        .maybeSingle();
      return data as Profile | null;
    },
  });

  if (!profile) {
    return { userId, profile: null, accessDenied: "missing_profile" };
  }
  if (!profile.active) {
    return { userId, profile: null, accessDenied: "inactive_profile" };
  }

  return {
    userId,
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

/** Super-admin style controls (verification override, etc.) — same as admin for now. */
export function isSuperAdmin(role: Profile["role"]) {
  return role === "admin";
}
