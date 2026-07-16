"use client";

import * as React from "react";
import { useEffect, useState } from "react";

import { NavNotifications } from "@/components/nav-notifications";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboardIcon,
  ChartBarIcon,
  Settings2Icon,
  SearchIcon,
  CalendarIcon,
  PenLineIcon,
  MailIcon,
  UsersIcon,
  WebhookIcon,
  RocketIcon,
  SendIcon,
  CreditCardIcon,
  Link2Icon,
} from "lucide-react";
import { FaWordpress, FaDev } from "react-icons/fa";
import { FaXTwitter, FaDiscord, FaTelegram } from "react-icons/fa6";
import Image from "next/image";
import Link from "next/link";
import { NavAutopost } from "./nav-autopost";
import { SiteSwitcher } from "./site-switcher";

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Calendar",
      url: "/calendar",
      icon: <CalendarIcon />,
    },
    {
      title: "Blogs",
      url: "/blogs",
      icon: <PenLineIcon />,
    },
    {
      title: "Keywords",
      url: "/keywords",
      icon: <SearchIcon />,
    },
    {
      title: "Autopilot",
      url: "/autopilot",
      icon: <RocketIcon />,
    },
    {
      title: "Destinations",
      url: "/destinations",
      icon: <SendIcon />,
    },
    {
      title: "Backlink Network",
      url: "/network",
      icon: <Link2Icon />,
    },
    {
      title: "Subscribers",
      url: "/subscribers",
      icon: <UsersIcon />,
    },
    {
      title: "Analytics",
      url: "/analytics",
      icon: <ChartBarIcon />,
    },
    {
      title: "Webhooks",
      url: "/webhooks",
      icon: <WebhookIcon />,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/settings",
      icon: <Settings2Icon />,
    },
    {
      title: "Billing",
      url: "/billing",
      icon: <CreditCardIcon />,
    },
  ],
  // The platforms cross-posting actually supports — all managed on /destinations.
  navAutopost: [
    {
      name: "WordPress",
      url: "/destinations",
      icon: <FaWordpress />,
    },
    {
      name: "Dev.to",
      url: "/destinations",
      icon: <FaDev />,
    },
    {
      name: "X (formerly Twitter)",
      url: "/destinations",
      icon: <FaXTwitter />,
    },
  ],
  documents: [
    {
      name: "Email",
      url: "#",
      icon: <MailIcon />,
    },
    {
      name: "Discord",
      url: "#",
      icon: <FaDiscord />,
    },
    {
      name: "Telegram",
      url: "#",
      icon: <FaTelegram />,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user, setUser] = useState({ name: "", email: "", avatar: "" });

  useEffect(() => {
    fetch(`${API_URL}/auth/me`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setUser({
          name: data.name || "",
          email: data.email || "",
          avatar: data.avatarUrl || "",
        });
      })
      .catch(() => {});
  }, []);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/" className="flex shrink-0 items-center gap-2">
                <Image
                  src="/logo.svg"
                  alt="logo"
                  width={25}
                  height={10}
                  className="dark:invert"
                />
                <h1 className="text-xl font-semibold">Writora</h1>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SiteSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavAutopost items={data.navAutopost} />
        <NavNotifications items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
