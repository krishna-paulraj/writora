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
  CameraIcon,
  FileTextIcon,
  Settings2Icon,
  CircleHelpIcon,
  SearchIcon,
  CalendarIcon,
  PenLineIcon,
  MailIcon,
  BotMessageSquareIcon,
  MessageCircleCheckIcon,
} from "lucide-react";
import { FaWordpress } from "react-icons/fa";
import { FaXTwitter, FaMedium, FaDiscord, FaTelegram } from "react-icons/fa6";
import Image from "next/image";
import Link from "next/link";
import { NavAutopost } from "./nav-autopost";

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
      title: "Analytics",
      url: "/analytics",
      icon: <ChartBarIcon />,
    },
  ],
  navClouds: [
    {
      title: "Capture",
      icon: <CameraIcon />,
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: <FileTextIcon />,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: <FileTextIcon />,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/settings",
      icon: <Settings2Icon />,
    },
    {
      title: "Get Help",
      url: "#",
      icon: <CircleHelpIcon />,
    },
    {
      title: "Search",
      url: "#",
      icon: <SearchIcon />,
    },
  ],
  navAutopost: [
    {
      name: "WordPress",
      url: "#",
      icon: <FaWordpress />,
    },
    {
      name: "Medium",
      url: "#",
      icon: <FaMedium />,
    },
    {
      name: "X (formerly Twitter)",
      url: "#",
      icon: <FaXTwitter />,
    },
    {
      name: "Newsletter",
      url: "#",
      icon: <MailIcon />,
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
          avatar: "",
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
