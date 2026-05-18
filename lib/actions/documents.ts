"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";

export async function getSignedCrmDocUrl(path: string) {
  const { profile } = await getSessionProfile();
  if (!profile) return { error: "Unauthorized" as const };
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("crm-docs")
    .createSignedUrl(path, 120);
  if (error) return { error: error.message };
  return { url: data.signedUrl };
}
