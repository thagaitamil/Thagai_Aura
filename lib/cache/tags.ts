export const cacheTags = {
  areas: "areas",
  dashboard: "dashboard",
  lead: (id: string) => `lead:${id}`,
  leads: "leads",
  profiles: "profiles",
  search: "search",
  supply: (id: string) => `supply:${id}`,
  supplyList: "supply:list",
};

export function leadMutationTags(leadId?: string | null) {
  return [
    cacheTags.leads,
    cacheTags.dashboard,
    cacheTags.search,
    ...(leadId ? [cacheTags.lead(leadId)] : []),
  ];
}

export function supplyMutationTags(supplyId?: string | null) {
  return [
    cacheTags.supplyList,
    cacheTags.dashboard,
    cacheTags.search,
    ...(supplyId ? [cacheTags.supply(supplyId)] : []),
  ];
}
