import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, canWriteSupply } from "@/lib/auth/session";
import { SupplyForm } from "@/components/supply/supply-form";
import { CACHE_TTL_SECONDS, cached } from "@/lib/cache/redis";
import { cacheTags } from "@/lib/cache/tags";

export default async function NewSupplyPage() {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteSupply(profile.role)) {
    redirect("/supply");
  }
  const supabase = createClient();
  const areas = await cached({
    key: "areas:active:sorted",
    tags: [cacheTags.areas],
    ttlSeconds: CACHE_TTL_SECONDS,
    getFresh: async () => {
      const { data } = await supabase
        .from("area_options")
        .select("id, label")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">Add supply</h1>
        <p className="text-sm text-muted-foreground">
          Add a profile with areas, languages, Aadhaar, and documents. Search or create locations inline.
        </p>
      </div>
      <SupplyForm
        mode="create"
        areas={areas}
        isAdmin={profile.role === "admin"}
      />
    </div>
  );
}
