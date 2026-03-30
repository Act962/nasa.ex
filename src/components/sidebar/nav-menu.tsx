"use client";

import {
  Calendar,
  ChartColumnDecreasingIcon,
  ClipboardType,
  Home as HomeIcon,
  Kanban,
  LayoutGrid,
  MessageSquareTextIcon,
  Plug2,
  Users,
} from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { title: "Início",       url: "/home",           icon: HomeIcon },
  { title: "Trackings",    url: "/tracking",      icon: Kanban },
  { title: "Formulários",  url: "/form",           icon: ClipboardType },
  { title: "Chats",        url: "/tracking-chat",  icon: MessageSquareTextIcon },
  { title: "Agenda",       url: "/agendas",        icon: Calendar },
  { title: "Contatos",     url: "/contatos",       icon: Users },
  { title: "Insights",     url: "/insights",       icon: ChartColumnDecreasingIcon },
  { title: "Integrações",  url: "/integrations",   icon: Plug2 },
  { title: "Apps",         url: "/apps",           icon: LayoutGrid },
];

export function NavMenu() {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Menu</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item, index) => {
          const isActive =
            pathname === item.url ||
            (item.url !== "/home" && pathname.startsWith(item.url + "/"));

          return (
            <SidebarMenuItem key={`${item.title}-${index}`}>
              <SidebarMenuButton
                tooltip={item.title}
                asChild
                className={cn(
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
              >
                <Link href={item.url}>
                  <item.icon />
                  <span> {item.title} </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
