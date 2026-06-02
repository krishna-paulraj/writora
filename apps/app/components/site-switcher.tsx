"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  GlobeIcon,
  PlusIcon,
  Settings2Icon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getActiveSiteId, setActiveSiteId } from "@/lib/active-site";
import { listSites, type Site } from "@/lib/sites";

export function SiteSwitcher() {
  const [sites, setSites] = useState<Site[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    listSites()
      .then((all) => {
        setSites(all);
        const stored = getActiveSiteId();
        const valid =
          stored && all.some((s) => s.id === stored)
            ? stored
            : (all.find((s) => s.isPrimary)?.id ?? all[0]?.id ?? null);
        setActiveId(valid);
        // Normalize a stale/missing selection so the header matches the UI.
        if (valid && valid !== stored) setActiveSiteId(valid);
      })
      .catch(() => {});
  }, []);

  const select = (id: string) => {
    if (id === activeId) return;
    setActiveSiteId(id);
    // Reload so every data fetch re-runs with the new X-Writora-Site header.
    window.location.reload();
  };

  // Single-site accounts don't need a switcher chrome — but still show it once
  // there's more than one site, or while we know the active one.
  if (sites.length === 0) return null;
  const active = sites.find((s) => s.id === activeId) ?? sites[0];

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent"
            >
              <div className="bg-sidebar-primary/10 text-sidebar-primary flex aspect-square size-8 items-center justify-center rounded-lg">
                <GlobeIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{active.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {active.isPrimary ? active.slug : `s/${active.slug}`}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4 opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Sites
            </DropdownMenuLabel>
            {sites.map((s) => (
              <DropdownMenuItem key={s.id} onClick={() => select(s.id)}>
                <span className="flex-1 truncate">{s.name}</span>
                {s.id === active.id && <CheckIcon className="size-4" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/sites">
                <Settings2Icon className="mr-2 size-4" />
                Manage sites
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/sites?new=1">
                <PlusIcon className="mr-2 size-4" />
                New site
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
