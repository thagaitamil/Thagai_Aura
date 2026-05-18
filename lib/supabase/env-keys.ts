/**
 * Public Supabase client key: legacy anon JWT or new publishable key (`sb_publishable_...`).
 * Prefer setting exactly one in production.
 */
export function getPublicSupabaseKey(): string {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const key = anon || publishable;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!key) {
    if (url) {
      console.error(
        "[supabase] NEXT_PUBLIC_SUPABASE_URL is set but neither NEXT_PUBLIC_SUPABASE_ANON_KEY nor NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is set."
      );
    }
    throw new Error(
      "Missing public Supabase API key: set NEXT_PUBLIC_SUPABASE_ANON_KEY (legacy) or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }
  return key;
}

/** True when URL and at least one public key are present (for root middleware guard). */
export function hasSupabasePublicEnv(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return Boolean(url && key);
}
