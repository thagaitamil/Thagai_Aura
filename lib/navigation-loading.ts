/** Dispatched before programmatic client navigations so the global bar can show immediately. */
export const AURA_NAV_LOADING = "aura-nav-loading-start";

export function signalAuraNavigationStart() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AURA_NAV_LOADING));
}
