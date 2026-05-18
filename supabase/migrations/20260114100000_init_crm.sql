-- Thagai CRM (AURA) — initial schema
-- Run via Supabase CLI: supabase db push / link project

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "pg_trgm";

-- Profiles (1:1 auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext,
  full_name text,
  role text not null default 'viewer' check (role in ('admin', 'operations', 'sales', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);
create index profiles_active_idx on public.profiles (active);

-- Admin-managed area tags + optional free text on entities
create table public.area_options (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index area_options_active_idx on public.area_options (is_active, sort_order);

-- Supply
create table public.supply_profiles (
  id uuid primary key default gen_random_uuid(),
  photo_url text,
  full_name text not null,
  phone citext not null,
  alt_phone citext,
  address text,
  district text,
  state text,
  gender text check (gender in ('male', 'female', 'other')),
  age int,
  type text not null check (type in ('caretaker', 'nurse')),
  availability text not null check (availability in ('12h', '24h', 'monthly', 'part_time')),
  service_scope text not null default 'chennai_all' check (service_scope in ('chennai_all', 'chennai_areas', 'outside_chennai')),
  languages text,
  salary_12h numeric(12,2),
  salary_24h numeric(12,2),
  salary_monthly numeric(12,2),
  verification_status text not null default 'pending' check (verification_status in ('verified', 'pending', 'not_verified')),
  verification_notes text,
  status text not null default 'available' check (status in ('available', 'on_duty', 'trial', 'reserved', 'temp_unavailable', 'inactive')),
  is_blacklisted boolean not null default false,
  area_free_text text,
  created_by uuid references public.profiles (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supply_area_tags (
  supply_id uuid not null references public.supply_profiles (id) on delete cascade,
  area_option_id uuid not null references public.area_options (id) on delete cascade,
  primary key (supply_id, area_option_id)
);

create table public.supply_references (
  id uuid primary key default gen_random_uuid(),
  supply_id uuid not null references public.supply_profiles (id) on delete cascade,
  ref_name text not null,
  relationship text,
  phone citext,
  verification_status text not null default 'pending' check (verification_status in ('verified', 'pending', 'not_verified')),
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.supply_activities (
  id uuid primary key default gen_random_uuid(),
  supply_id uuid not null references public.supply_profiles (id) on delete cascade,
  activity_type text not null check (activity_type in (
    'assigned', 'trial_completed', 'service_completed', 'complaint', 'no_response',
    'left_midway', 'blacklisted', 'positive_feedback', 'note'
  )),
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.supply_risk_markers (
  id uuid primary key default gen_random_uuid(),
  supply_id uuid not null references public.supply_profiles (id) on delete cascade,
  category text not null check (category in (
    'no_calls', 'salary_issues', 'unprofessional', 'fake_info', 'absconding', 'reliability', 'other'
  )),
  notes text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.supply_documents (
  id uuid primary key default gen_random_uuid(),
  supply_id uuid not null references public.supply_profiles (id) on delete cascade,
  doc_type text not null check (doc_type in ('aadhaar', 'photo', 'medical', 'smart_card', 'other')),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Leads
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone citext not null,
  alt_phone citext,
  area_free_text text,
  full_address text,
  requirement_type text not null check (requirement_type in ('caretaker', 'nurse')),
  gender_preference text not null default 'any' check (gender_preference in ('male', 'female', 'any')),
  service_duration text not null check (service_duration in ('12h', '24h', 'monthly')),
  budget_min numeric(12,2),
  budget_max numeric(12,2),
  start_date date,
  special_notes text,
  status text not null default 'new_lead' check (status in (
    'new_lead', 'mql', 'sql', 'good_lead', 'hot_lead', 'converted', 'closed_lost'
  )),
  converted_at timestamptz,
  follow_up_required boolean not null default false,
  follow_up_at timestamptz,
  follow_up_notes text,
  created_by uuid references public.profiles (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lead_area_tags (
  lead_id uuid not null references public.leads (id) on delete cascade,
  area_option_id uuid not null references public.area_options (id) on delete cascade,
  primary key (lead_id, area_option_id)
);

create table public.lead_assignments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  assigned_to uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id),
  assigned_at timestamptz not null default now()
);

create unique index lead_assignments_one_active on public.lead_assignments (lead_id);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  activity_type text not null check (activity_type in (
    'inquiry', 'shared_pricing', 'requested_change', 'followup_done',
    'trial_scheduled', 'trial_completed', 'converted', 'closed', 'note'
  )),
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.lead_follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  due_at timestamptz not null,
  notes text,
  outcome text check (outcome in ('pending', 'completed', 'missed', 'rescheduled', 'cancelled')),
  completed_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.lead_documents (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  doc_type text not null check (doc_type in ('agreement', 'id_proof', 'address_proof', 'medical', 'other')),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.supply_mapping (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  supply_id uuid not null references public.supply_profiles (id) on delete cascade,
  priority smallint not null check (priority between 1 and 3),
  trial_status text not null default 'suggested' check (trial_status in (
    'suggested', 'shared', 'trial_scheduled', 'trial_completed', 'accepted', 'rejected'
  )),
  is_reserved boolean not null default false,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, priority)
);

create unique index supply_mapping_lead_supply on public.supply_mapping (lead_id, supply_id);

create index supply_profiles_name_trgm on public.supply_profiles using gin (full_name gin_trgm_ops);
create index supply_profiles_phone_idx on public.supply_profiles (phone);
create index leads_name_trgm on public.leads using gin (name gin_trgm_ops);
create index leads_phone_idx on public.leads (phone);

-- updated_at triggers
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated before update on public.profiles
for each row execute function public.set_updated_at();

create trigger supply_updated before update on public.supply_profiles
for each row execute function public.set_updated_at();

create trigger leads_updated before update on public.leads
for each row execute function public.set_updated_at();

create trigger supply_mapping_updated before update on public.supply_mapping
for each row execute function public.set_updated_at();

-- RLS: team-only — any authenticated user can access (tighten later per role in app layer)
alter table public.profiles enable row level security;
alter table public.area_options enable row level security;
alter table public.supply_profiles enable row level security;
alter table public.supply_area_tags enable row level security;
alter table public.supply_references enable row level security;
alter table public.supply_activities enable row level security;
alter table public.supply_risk_markers enable row level security;
alter table public.supply_documents enable row level security;
alter table public.leads enable row level security;
alter table public.lead_area_tags enable row level security;
alter table public.lead_assignments enable row level security;
alter table public.lead_activities enable row level security;
alter table public.lead_follow_ups enable row level security;
alter table public.lead_documents enable row level security;
alter table public.supply_mapping enable row level security;

create policy "authenticated_all_profiles" on public.profiles for all to authenticated using (true) with check (true);
create policy "authenticated_all_area_options" on public.area_options for all to authenticated using (true) with check (true);
create policy "authenticated_all_supply" on public.supply_profiles for all to authenticated using (true) with check (true);
create policy "authenticated_all_supply_area" on public.supply_area_tags for all to authenticated using (true) with check (true);
create policy "authenticated_all_supply_refs" on public.supply_references for all to authenticated using (true) with check (true);
create policy "authenticated_all_supply_act" on public.supply_activities for all to authenticated using (true) with check (true);
create policy "authenticated_all_supply_risk" on public.supply_risk_markers for all to authenticated using (true) with check (true);
create policy "authenticated_all_supply_docs" on public.supply_documents for all to authenticated using (true) with check (true);
create policy "authenticated_all_leads" on public.leads for all to authenticated using (true) with check (true);
create policy "authenticated_all_lead_area" on public.lead_area_tags for all to authenticated using (true) with check (true);
create policy "authenticated_all_lead_assign" on public.lead_assignments for all to authenticated using (true) with check (true);
create policy "authenticated_all_lead_act" on public.lead_activities for all to authenticated using (true) with check (true);
create policy "authenticated_all_lead_fu" on public.lead_follow_ups for all to authenticated using (true) with check (true);
create policy "authenticated_all_lead_docs" on public.lead_documents for all to authenticated using (true) with check (true);
create policy "authenticated_all_mapping" on public.supply_mapping for all to authenticated using (true) with check (true);

-- Auto-create profile on signup (optional; admin may create via dashboard)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email::citext,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'viewer')
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
