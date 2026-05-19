import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getPublicSupabaseKey } from "@/lib/supabase/env-keys";

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  let publicKey: string;
  try {
    publicKey = getPublicSupabaseKey();
  } catch {
    return NextResponse.json({ areas: [] }, { status: 503 });
  }
  if (!url) return NextResponse.json({ areas: [] }, { status: 503 });

  const cookieStore = cookies();
  const supabase = createServerClient(url, publicKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* ignore */
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  let query = supabase
    .from("area_options")
    .select("id, label")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true })
    .limit(50);
  if (q.length >= 1) {
    query = query.ilike("label", `%${q.replace(/[%_]/g, "")}%`);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ areas: data ?? [] });
}
