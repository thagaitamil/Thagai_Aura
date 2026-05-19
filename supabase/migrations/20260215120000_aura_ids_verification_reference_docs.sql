-- AURA: trail numbers, supply display numbers, Aadhaar, verification override,
-- lead verification + doc types, reference documents, sequences.

-- Sequences for human-facing incremental IDs
CREATE SEQUENCE IF NOT EXISTS public.lead_trail_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.supply_display_number_seq START WITH 1 INCREMENT BY 1;

-- Leads: trail number (L00001) + verification
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS trail_number bigint UNIQUE,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('verified', 'pending', 'not_verified')),
  ADD COLUMN IF NOT EXISTS verification_manual_override boolean NOT NULL DEFAULT false;

-- Backfill trail numbers for existing rows
UPDATE public.leads
SET trail_number = sub.n
FROM (
  SELECT id, row_number() OVER (ORDER BY created_at ASC) AS n FROM public.leads
) sub
WHERE public.leads.id = sub.id AND public.leads.trail_number IS NULL;

SELECT setval(
  'public.lead_trail_number_seq',
  GREATEST(COALESCE((SELECT MAX(trail_number) FROM public.leads), 1), 1),
  COALESCE((SELECT MAX(trail_number) FROM public.leads), 0) > 0
);

CREATE OR REPLACE FUNCTION public.assign_lead_trail_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.trail_number IS NULL THEN
    NEW.trail_number := nextval('public.lead_trail_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_assign_trail_number ON public.leads;
CREATE TRIGGER leads_assign_trail_number
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_lead_trail_number();

-- Supply: display number (S00001), Aadhaar, verification override
ALTER TABLE public.supply_profiles
  ADD COLUMN IF NOT EXISTS supply_number bigint UNIQUE,
  ADD COLUMN IF NOT EXISTS aadhaar_number text,
  ADD COLUMN IF NOT EXISTS verification_manual_override boolean NOT NULL DEFAULT false;

UPDATE public.supply_profiles
SET supply_number = sub.n
FROM (
  SELECT id, row_number() OVER (ORDER BY created_at ASC) AS n FROM public.supply_profiles
) sub
WHERE public.supply_profiles.id = sub.id AND public.supply_profiles.supply_number IS NULL;

SELECT setval(
  'public.supply_display_number_seq',
  GREATEST(COALESCE((SELECT MAX(supply_number) FROM public.supply_profiles), 1), 1),
  COALESCE((SELECT MAX(supply_number) FROM public.supply_profiles), 0) > 0
);

CREATE OR REPLACE FUNCTION public.assign_supply_display_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.supply_number IS NULL THEN
    NEW.supply_number := nextval('public.supply_display_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS supply_profiles_assign_number ON public.supply_profiles;
CREATE TRIGGER supply_profiles_assign_number
  BEFORE INSERT ON public.supply_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_supply_display_number();

-- Lead documents: allow Aadhaar + smart card (match supply naming: aadhaar)
ALTER TABLE public.lead_documents DROP CONSTRAINT IF EXISTS lead_documents_doc_type_check;
ALTER TABLE public.lead_documents ADD CONSTRAINT lead_documents_doc_type_check
  CHECK (doc_type IN (
    'agreement', 'id_proof', 'address_proof', 'medical', 'aadhaar', 'smart_card', 'other'
  ));

-- Reference-level documents
CREATE TABLE IF NOT EXISTS public.supply_reference_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id uuid NOT NULL REFERENCES public.supply_references (id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('aadhaar', 'photo', 'medical', 'smart_card', 'other')),
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supply_reference_documents_ref_idx
  ON public.supply_reference_documents (reference_id);

ALTER TABLE public.supply_reference_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_supply_ref_docs" ON public.supply_reference_documents;
CREATE POLICY "authenticated_all_supply_ref_docs"
  ON public.supply_reference_documents FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS leads_trail_number_idx ON public.leads (trail_number);
CREATE INDEX IF NOT EXISTS supply_profiles_supply_number_idx ON public.supply_profiles (supply_number);

-- Ask PostgREST/Supabase API to refresh its schema cache after DDL changes.
NOTIFY pgrst, 'reload schema';
