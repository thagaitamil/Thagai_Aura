/**
 * Apply SQL migrations with psql (DDL — not possible via Supabase REST API keys alone).
 *
 * Option A — full URI in .env.local:
 *   DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@db.<ref>.supabase.co:5432/postgres?sslmode=require
 *
 * Option B — only DB password (ref parsed from NEXT_PUBLIC_SUPABASE_URL):
 *   SUPABASE_DB_PASSWORD=YOUR_DB_PASSWORD
 *
 * Usage:
 *   cd thagai-portal && npm run db:apply
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvLocal() {
  const p = resolve(root, ".env.local");
  if (!existsSync(p)) {
    console.error("Missing .env.local in thagai-portal");
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

function resolveDatabaseUrl(env) {
  if (env.DATABASE_URL?.trim()) {
    let u = env.DATABASE_URL.trim();
    if (!u.includes("sslmode=")) {
      u += (u.includes("?") ? "&" : "?") + "sslmode=require";
    }
    return u;
  }
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const pass = env.SUPABASE_DB_PASSWORD?.trim();
  if (!supabaseUrl || !pass) return null;
  let host;
  try {
    host = new URL(supabaseUrl).hostname;
  } catch {
    return null;
  }
  const ref = host.split(".")[0];
  if (!ref) return null;
  const enc = encodeURIComponent(pass);
  return `postgresql://postgres:${enc}@db.${ref}.supabase.co:5432/postgres?sslmode=require`;
}

const env = loadEnvLocal();
const databaseUrl = resolveDatabaseUrl(env);

if (!databaseUrl) {
  console.error(`
Cannot apply migrations: no Postgres connection configured.

Supabase "anon" / "service_role" API keys cannot run CREATE TABLE. You need the database password:

1) Supabase Dashboard → Project Settings → Database → copy the connection string (URI),
   add to .env.local as:
     DATABASE_URL=postgresql://postgres:....@db.<ref>.supabase.co:5432/postgres

   OR add only the DB password you set when creating the project:
     SUPABASE_DB_PASSWORD=your_password

   (ref is taken from NEXT_PUBLIC_SUPABASE_URL — already in .env.local)

2) Then run:  npm run db:apply
3) Then run:  npm run seed:dev
`);
  process.exit(1);
}

const migrations = [
  resolve(root, "supabase/migrations/20260114100000_init_crm.sql"),
  resolve(root, "supabase/migrations/20260114100001_storage_crm_docs.sql"),
  resolve(root, "supabase/migrations/20260215120000_aura_ids_verification_reference_docs.sql"),
  resolve(root, "supabase/migrations/20260215123000_lead_service_dates.sql"),
  resolve(root, "supabase/migrations/20260215124500_performance_indexes.sql"),
];

function relationExists(name) {
  const r = spawnSync(
    "psql",
    [
      databaseUrl,
      "-v",
      "ON_ERROR_STOP=1",
      "-Atc",
      `select to_regclass('public.${name}') is not null;`,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PGSSLMODE: "require" },
    }
  );
  if (r.status !== 0) return false;
  return r.stdout.trim() === "t";
}

const hasBaseSchema = relationExists("profiles");
const migrationsToApply = hasBaseSchema ? migrations.slice(2) : migrations;

if (hasBaseSchema) {
  console.log("Existing CRM schema detected; applying incremental migrations only.");
}

for (const file of migrationsToApply) {
  if (!existsSync(file)) {
    console.error("Missing migration file:", file);
    process.exit(1);
  }
  console.log("Applying", file);
  const r = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", file], {
    stdio: "inherit",
    env: { ...process.env, PGSSLMODE: "require" },
  });
  if (r.status !== 0) {
    console.error("psql failed for", file);
    process.exit(r.status ?? 1);
  }
}

console.log("\nMigrations applied. Next: npm run seed:dev");
