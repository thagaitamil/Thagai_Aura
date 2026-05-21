import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (claimsData?.claims.sub) redirect("/dashboard");
  redirect("/login");
}
