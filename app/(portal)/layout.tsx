import { redirect } from "next/navigation";
import { PortalShell } from "@/components/layout/portal-shell";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile, accessDenied } = await getSessionProfile();
  if (!profile) {
    await supabase.auth.signOut();
    const q = accessDenied ? `?reason=${accessDenied}` : "";
    redirect(`/login${q}`);
  }

  return <PortalShell profile={profile}>{children}</PortalShell>;
}
