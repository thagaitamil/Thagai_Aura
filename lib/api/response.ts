import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth/session";

export async function requireApiProfile() {
  const { profile } = await getSessionProfile();
  if (!profile) {
    return {
      profile: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { profile, response: null };
}
