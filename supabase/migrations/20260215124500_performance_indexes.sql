create index if not exists lead_documents_lead_id_idx on public.lead_documents(lead_id);
create index if not exists lead_follow_ups_lead_id_idx on public.lead_follow_ups(lead_id);
create index if not exists lead_activities_lead_id_idx on public.lead_activities(lead_id);
create index if not exists lead_assignments_lead_id_idx on public.lead_assignments(lead_id);
create index if not exists lead_assignments_assigned_to_idx on public.lead_assignments(assigned_to);
create index if not exists lead_area_tags_lead_id_idx on public.lead_area_tags(lead_id);
create index if not exists lead_area_tags_area_option_id_idx on public.lead_area_tags(area_option_id);
create index if not exists leads_created_by_idx on public.leads(created_by);
create index if not exists leads_follow_up_at_idx on public.leads(follow_up_at);
create index if not exists leads_status_idx on public.leads(status);

create index if not exists supply_documents_supply_id_idx on public.supply_documents(supply_id);
create index if not exists supply_references_supply_id_idx on public.supply_references(supply_id);
create index if not exists supply_reference_documents_reference_id_idx on public.supply_reference_documents(reference_id);
create index if not exists supply_mapping_lead_id_idx on public.supply_mapping(lead_id);
create index if not exists supply_mapping_supply_id_idx on public.supply_mapping(supply_id);
create index if not exists supply_area_tags_supply_id_idx on public.supply_area_tags(supply_id);
create index if not exists supply_area_tags_area_option_id_idx on public.supply_area_tags(area_option_id);
create index if not exists supply_activities_supply_id_idx on public.supply_activities(supply_id);
create index if not exists supply_risk_markers_supply_id_idx on public.supply_risk_markers(supply_id);
create index if not exists supply_profiles_status_idx on public.supply_profiles(status);

notify pgrst, 'reload schema';
