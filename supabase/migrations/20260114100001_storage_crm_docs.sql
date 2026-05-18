-- Private bucket for CRM uploads (supply + lead documents)
insert into storage.buckets (id, name, public)
values ('crm-docs', 'crm-docs', false)
on conflict (id) do nothing;

create policy "crm_docs_authenticated_select"
on storage.objects for select to authenticated
using (bucket_id = 'crm-docs');

create policy "crm_docs_authenticated_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'crm-docs');

create policy "crm_docs_authenticated_update"
on storage.objects for update to authenticated
using (bucket_id = 'crm-docs');

create policy "crm_docs_authenticated_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'crm-docs');
