"use client";

import {
  BookCheck,
  Calendar,
  ClipboardType,
  File,
  Kanban,
  MessageSquareTextIcon,
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
  {
    title: "Trackings",
    url: "/tracking",
    icon: Kanban,
    isActive: true,
  },
  {
    title: "Propostas",
    url: "/tracking/proposta",
    icon: File,
    isActive: true,
  },
  {
    title: "Formulários",
    url: "/form",
    icon: ClipboardType,
    isActive: true,
  },
  {
    title: "Chats",
    url: "/tracking-chat",
    icon: MessageSquareTextIcon,
    isActive: true,
  },
  {
    title: "Agenda",
    url: "/agenda",
    icon: Calendar,
    isActive: true,
  },
  {
    title: "Contatos",
    url: "/contatos",
    icon: Users,
    isActive: true,
  },
  {
    title: "Atividades",
    url: "/tracking/atividades",
    icon: BookCheck,
    isActive: true,
  },
];

export function NavMenu() {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Menu</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item, index) => {
          const isActive = pathname.startsWith(item.url);

          return (
            <SidebarMenuItem key={`${item.title}-${index}`}>
              <SidebarMenuButton
                tooltip={item.title}
                asChild
                className={cn(
                  isActive &&
                    "bg-sidebar-accent text-sidebar-accent-foreground",
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
