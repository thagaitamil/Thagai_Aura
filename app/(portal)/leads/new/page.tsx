import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, canWriteLeads } from "@/lib/auth/session";
import { LeadForm } from "@/components/leads/lead-form";
import { CACHE_TTL_SECONDS, cached } from "@/lib/cache/redis";
import { cacheTags } from "@/lib/cache/tags";

export default async function NewLeadPage() {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteLeads(profile.role)) {
    redirect("/leads");
  }
  const supabase = createClient();
  const [areas, staff] = await Promise.all([
    cached({
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
    }),
    cached({
      key: "profiles:active:sorted",
      tags: [cacheTags.profiles],
      ttlSeconds: CACHE_TTL_SECONDS,
      getFresh: async () => {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("active", true)
          .order("full_name", { ascending: true });
        return data ?? [];
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">Add lead</h1>
        <p className="text-sm text-muted-foreground">
          Log the inquiry, attach area tags, and add optional free-text location notes.
        </p>
      </div>
      <LeadForm
        mode="create"
        areas={areas}
        staff={staff}
        isAdmin={profile.role === "admin"}
        defaultAssignedTo={profile.id}
      />
    </div>
  );
}
