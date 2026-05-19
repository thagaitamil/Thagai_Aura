"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import { cn } from "@/lib/utils";

type PickerPopoverProps = {
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
  id: string;
  open: boolean;
  role?: string;
};

type PopoverPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

export function PickerPopover({
  anchorRef,
  children,
  className,
  id,
  open,
  role = "listbox",
}: PickerPopoverProps) {
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const gutter = 12;
      const gap = 8;
      const availableBelow = window.innerHeight - rect.bottom - gutter;
      const availableAbove = rect.top - gutter;
      const placeAbove = availableBelow < 220 && availableAbove > availableBelow;
      const maxHeight = Math.max(180, Math.min(360, placeAbove ? availableAbove - gap : availableBelow - gap));
      const top = placeAbove ? Math.max(gutter, rect.top - gap - maxHeight) : rect.bottom + gap;

      setPosition({
        left: Math.max(gutter, Math.min(rect.left, window.innerWidth - rect.width - gutter)),
        top,
        width: rect.width,
        maxHeight,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, open]);

  if (!mounted || !open || !position) return null;

  return createPortal(
    <div
      id={id}
      role={role}
      className={cn("aura-picker-panel", className)}
      style={{
        left: position.left,
        maxHeight: position.maxHeight,
        top: position.top,
        width: position.width,
      }}
      onMouseDown={(event) => event.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  );
}
