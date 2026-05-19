alter table public.leads
  add column if not exists end_date date,
  add column if not exists service_is_ongoing boolean not null default false;

notify pgrst, 'reload schema';
