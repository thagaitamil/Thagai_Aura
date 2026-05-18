import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, canWriteLeads } from "@/lib/auth/session";
import { LeadForm } from "@/components/leads/lead-form";

export default async function NewLeadPage() {
  const { profile } = await getSessionProfile();
  if (!profile || !canWriteLeads(profile.role)) {
    redirect("/leads");
  }
  const supabase = createClient();
  const { data: areas } = await supabase
    .from("area_options")
    .select("id, label")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("active", true)
    .order("full_name", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">Add lead</h1>
        <p className="text-sm text-muted-foreground">
          Log the inquiry, attach area tags, and add optional free-text location notes.
        </p>
      </div>
      <LeadForm mode="create" areas={areas ?? []} staff={staff ?? []} />
    </div>
  );
}
