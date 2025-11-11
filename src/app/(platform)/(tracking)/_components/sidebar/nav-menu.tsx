"use client";

import {
  BookCheck,
  Calendar,
  ClipboardType,
  File,
  Kanban,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";

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
    url: "/tracking/formulario",
    icon: ClipboardType,
    isActive: true,
  },
  {
    title: "Agenda",
    url: "/tracking/agenda",
    icon: Calendar,
    isActive: true,
  },
  {
    title: "Contatos",
    url: "/tracking/contatos",
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
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Menu</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item, index) => {
          return (
            <SidebarMenuItem key={`${item.title}-${index}`}>
              <SidebarMenuButton tooltip={item.title} asChild>
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
