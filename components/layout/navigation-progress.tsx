"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AURA_NAV_LOADING } from "@/lib/navigation-loading";

type Phase = "idle" | "loading" | "completing";

/**
 * Top-of-viewport navigation bar. Uses document.body portal so it is never clipped by
 * sidebar overflow/transform. Starts on internal link pointerdown and on AURA_NAV_LOADING.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlKey = `${pathname}?${searchParams.toString()}`;

  const phaseRef = useRef<Phase>("idle");
  const [phase, setPhase] = useState<Phase>("idle");
  const prevUrlKey = useRef<string | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSafety = useCallback(() => {
    if (safetyRef.current) {
      clearTimeout(safetyRef.current);
      safetyRef.current = null;
    }
  }, []);

  const beginLoading = useCallback(() => {
    clearSafety();
    phaseRef.current = "loading";
    setPhase("loading");
    safetyRef.current = setTimeout(() => {
      phaseRef.current = "idle";
      setPhase("idle");
      safetyRef.current = null;
    }, 18_000);
  }, [clearSafety]);

  // Programmatic navigations (⌘K, filters, forms, etc.)
  useEffect(() => {
    const onSignal = () => beginLoading();
    window.addEventListener(AURA_NAV_LOADING, onSignal);
    return () => window.removeEventListener(AURA_NAV_LOADING, onSignal);
  }, [beginLoading]);

  // Same-origin <a href> navigations (sidebar, table links, …)
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const a = el?.closest?.("a[href]");
      if (!a || !(a instanceof HTMLAnchorElement)) return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      const hrefAttr = a.getAttribute("href");
      if (!hrefAttr || hrefAttr.startsWith("#") || hrefAttr.startsWith("mailto:") || hrefAttr.startsWith("tel:")) {
        return;
      }
      let next: string;
      try {
        const u = new URL(hrefAttr, window.location.origin);
        if (u.origin !== window.location.origin) return;
        next = u.pathname + u.search;
      } catch {
        return;
      }
      const here = window.location.pathname + window.location.search;
      if (next === here) return;
      beginLoading();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [beginLoading]);

  // URL committed → finish bar (App Router updates pathname/search after RSC)
  useEffect(() => {
    if (prevUrlKey.current === null) {
      prevUrlKey.current = urlKey;
      return;
    }
    if (prevUrlKey.current === urlKey) return;
    prevUrlKey.current = urlKey;

    if (phaseRef.current === "loading") {
      clearSafety();
      phaseRef.current = "completing";
      setPhase("completing");
    }
  }, [urlKey, clearSafety]);

  useEffect(() => {
    if (phase !== "completing") return;
    const t = setTimeout(() => {
      phaseRef.current = "idle";
      setPhase("idle");
    }, 480);
    return () => clearTimeout(t);
  }, [phase]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || phase === "idle") return null;

  const bar = (
    <div
      role="progressbar"
      aria-label={phase === "loading" ? "Loading page" : "Finishing"}
      aria-busy={phase === "loading"}
      className="pointer-events-none fixed left-0 right-0 top-0 z-[2147483000]"
    >
      <div className="h-[3px] w-full overflow-hidden bg-primary/25 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        {phase === "loading" ? (
          <div
            className={cn(
              "h-full w-[min(42vw,14rem)] rounded-none bg-accent",
              "shadow-[0_0_14px_hsl(var(--accent))]",
              "animate-nav-sweep",
            )}
          />
        ) : (
          <div
            key="done"
            className="h-full w-full origin-left scale-x-0 animate-nav-flash bg-accent shadow-[0_0_12px_hsl(var(--accent))]"
          />
        )}
      </div>
    </div>
  );

  return createPortal(bar, document.body);
}
