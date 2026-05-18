/**
 * Dev seed: Auth admin + minimal CRM rows.
 * Reads thagai-portal/.env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 *
 * Usage:
 *   cd thagai-portal && node scripts/seed-dev.mjs
 *
 * Optional env (defaults shown):
 *   SEED_ADMIN_EMAIL=superadmin@gmail.com
 *   SEED_ADMIN_PASSWORD=ThagaiDev2026!
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) {
    console.error("Missing .env.local in thagai-portal (cwd:", process.cwd(), ")");
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.SEED_ADMIN_EMAIL || "superadmin@gmail.com";
const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ThagaiDev2026!";

if (!url || !serviceKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function assertSchema() {
  const { error } = await supabase.from("profiles").select("id").limit(1);
  if (error?.code === "PGRST205" || error?.message?.includes("schema cache")) {
    console.error(
      "\nDatabase schema is missing (e.g. public.profiles). Run the SQL migrations in Supabase first:\n" +
        "  - supabase/migrations/20260114100000_init_crm.sql\n" +
        "  - supabase/migrations/20260114100001_storage_crm_docs.sql\n" +
        "See CRM_SETUP.md\n"
    );
    process.exit(1);
  }
  if (error) throw error;
}

async function ensureAdminUser() {
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { full_name: "Dev Admin" },
  });

  let userId;
  if (createErr) {
    const msg = createErr.message || "";
    if (
      msg.includes("already been registered") ||
      msg.includes("already registered") ||
      createErr.status === 422
    ) {
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (listErr) throw listErr;
      const u = list.users.find((x) => (x.email || "").toLowerCase() === adminEmail.toLowerCase());
      if (!u) throw new Error(`Could not create user and none found for ${adminEmail}: ${msg}`);
      userId = u.id;
      console.log("Auth user already exists:", adminEmail);
    } else {
      throw createErr;
    }
  } else {
    userId = created.user.id;
    console.log("Created auth user:", adminEmail);
  }

  const { error: upsertErr } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: adminEmail,
      full_name: "Dev Admin",
      role: "admin",
      active: true,
    },
    { onConflict: "id" }
  );
  if (upsertErr) throw upsertErr;
  console.log("Upserted profiles → admin, active.");

  return userId;
}

async function seedAreas(adminId) {
  const { count, error: cErr } = await supabase
    .from("area_options")
    .select("id", { count: "exact", head: true });
  if (cErr) throw cErr;
  if ((count ?? 0) > 0) {
    console.log("area_options already has rows, skip.");
    return;
  }
  const rows = [
    { label: "Adyar", sort_order: 10, is_active: true, created_by: adminId },
    { label: "Velachery", sort_order: 20, is_active: true, created_by: adminId },
    { label: "OMR", sort_order: 30, is_active: true, created_by: adminId },
  ];
  const { error } = await supabase.from("area_options").insert(rows);
  if (error) throw error;
  console.log("Inserted 3 area_options.");
}

async function seedSupply(adminId) {
  const phone = "+919000000001";
  const { data: existing } = await supabase
    .from("supply_profiles")
    .select("id")
    .eq("phone", phone)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) {
    console.log("Sample supply already exists (phone", phone, "), skip.");
    return;
  }
  const { error } = await supabase.from("supply_profiles").insert({
    full_name: "Seed Caretaker One",
    phone,
    type: "caretaker",
    availability: "12h",
    service_scope: "chennai_all",
    verification_status: "pending",
    status: "available",
    created_by: adminId,
  });
  if (error) throw error;
  console.log("Inserted sample supply_profiles row.");
}

async function seedLead(adminId) {
  const phone = "+919000000002";
  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("phone", phone)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) {
    console.log("Sample lead already exists (phone", phone, "), skip.");
    return;
  }
  const { error } = await supabase.from("leads").insert({
    name: "Seed Lead Household",
    phone,
    requirement_type: "caretaker",
    service_duration: "12h",
    status: "new_lead",
    created_by: adminId,
  });
  if (error) throw error;
  console.log("Inserted sample leads row.");
}

try {
  await assertSchema();
  const adminId = await ensureAdminUser();
  await seedAreas(adminId);
  await seedSupply(adminId);
  await seedLead(adminId);
  console.log("\nDone. Sign in at /login with:");
  console.log("  Email:", adminEmail);
  console.log("  Password:", adminPassword);
} catch (e) {
  console.error(e);
  process.exit(1);
}
