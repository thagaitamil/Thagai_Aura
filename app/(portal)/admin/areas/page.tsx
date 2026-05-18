import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isAdmin } from "@/lib/auth/session";
import { AreasAdmin } from "@/components/admin/areas-admin";

export default async function AdminAreasPage() {
  const { profile } = await getSessionProfile();
  if (!profile || !isAdmin(profile.role)) {
    redirect("/dashboard");
  }
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("area_options")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">Area tags</h1>
        <p className="text-sm text-muted-foreground">
          Admins define reusable area labels. Staff pick them on supply and leads, and can add
          optional free-text notes on each record.
        </p>
      </div>
      <AreasAdmin initial={rows ?? []} />
    </div>
  );
}
