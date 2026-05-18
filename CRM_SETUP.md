# Thagai CRM (portal)

## Environment

Copy to `.env.local`:

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Optional (new Supabase keys): use instead of anon — set one public key only in production.
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

For the browser and server, the app uses **`NEXT_PUBLIC_SUPABASE_ANON_KEY` if set, otherwise `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** (see `lib/supabase/env-keys.ts`).

`SUPABASE_SERVICE_ROLE_KEY` is **server-only**; required for **Admin → Team users** (invite). Never expose it as `NEXT_PUBLIC_*`.

## Supabase

1. Create a Supabase project.
2. Run SQL in order:
   - `supabase/migrations/20260114100000_init_crm.sql`
   - `supabase/migrations/20260114100001_storage_crm_docs.sql`
3. Authentication → enable Email provider.
4. Create the first user in **Authentication → Users**, then in **Table Editor → profiles** set `role` to `admin` and `active` to `true` for that user’s row (trigger creates the row on signup).

## Run locally

```bash
npm install
npm run dev
```

Open `/login`. Deploy on a subdomain (e.g. `crm.thagai.com`) with the same env vars on Vercel.
