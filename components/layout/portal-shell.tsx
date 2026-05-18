"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCircle2,
  MapPinned,
  LogOut,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { signOutAction } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/layout/global-search";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/supply", label: "Supply", icon: Users },
  { href: "/leads", label: "Leads", icon: ClipboardList },
];

const adminNav = [
  { href: "/admin/areas", label: "Area tags", icon: MapPinned },
  { href: "/admin/users", label: "Team users", icon: UserCircle2 },
  { href: "/admin/permissions", label: "Permissions", icon: ShieldCheck },
];

function NavLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <SidebarMenuItem>
      <Link
        href={href}
        className={cn(
          buttonVariants({
            variant: active ? "secondary" : "ghost",
            size: "default",
          }),
          "w-full justify-start gap-2 text-sidebar-foreground",
          active && "bg-sidebar-accent text-sidebar-accent-foreground"
        )}
      >
        <Icon className="size-4 shrink-0" />
        {label}
      </Link>
    </SidebarMenuItem>
  );
}

export function PortalShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <SidebarProvider className="h-svh overflow-hidden">
        <Sidebar className="border-sidebar-border">
          <SidebarHeader className="gap-2 border-b border-sidebar-border p-4">
            <Link
              href="/dashboard"
              className="font-serif text-lg font-semibold tracking-tight text-sidebar-foreground hover:text-sidebar-primary"
            >
              Thagai CRM
            </Link>
            <p className="text-xs text-sidebar-foreground/70">Internal operations</p>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigate</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nav.map((item) => (
                    <NavLink key={item.href} {...item} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {profile.role === "admin" && (
              <SidebarGroup>
                <SidebarGroupLabel>Admin</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminNav.map((item) => (
                      <NavLink key={item.href} {...item} />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border p-3">
            <div className="mb-2 flex items-center gap-2 px-1">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-sidebar-foreground">
                  {profile.full_name ?? profile.email ?? "Team member"}
                </span>
                <Badge
                  variant="outline"
                  className="mt-1 w-fit border-sidebar-border text-[10px] uppercase text-sidebar-foreground/80"
                >
                  {profile.role}
                </Badge>
              </div>
            </div>
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="outline"
                className="w-full border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </form>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="min-h-0 overflow-hidden bg-background">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4">
            <SidebarTrigger className="text-foreground" />
            <Separator orientation="vertical" className="h-6" />
            <GlobalSearch />
            <Separator orientation="vertical" className="hidden h-6 sm:block" />
            <span className="text-sm text-muted-foreground">AURA · Thagai</span>
          </header>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 md:p-6" id="main-scroll">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
