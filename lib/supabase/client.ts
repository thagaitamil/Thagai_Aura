import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseKey } from "@/lib/supabase/env-keys";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getPublicSupabaseKey()
  );
}
