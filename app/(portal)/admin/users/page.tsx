import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isAdmin } from "@/lib/auth/session";
import { TeamUsersAdmin } from "@/components/admin/team-users-admin";
import { CACHE_TTL_SECONDS, cached } from "@/lib/cache/redis";
import { cacheTags } from "@/lib/cache/tags";

export default async function AdminUsersPage() {
  const { profile } = await getSessionProfile();
  if (!profile || !isAdmin(profile.role)) {
    redirect("/dashboard");
  }
  const supabase = createClient();
  const users = await cached({
    key: "admin-users:list",
    tags: [cacheTags.profiles],
    ttlSeconds: CACHE_TTL_SECONDS,
    getFresh: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, active, created_at")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">Team users</h1>
        <p className="text-sm text-muted-foreground">
          Invite teammates with email and password. Set{" "}
          <code className="rounded bg-muted px-1">SUPABASE_SERVICE_ROLE_KEY</code> for invites to
          work.
        </p>
      </div>
      <TeamUsersAdmin users={users} currentUserId={profile.id} />
    </div>
  );
}
