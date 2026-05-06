"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Star,
  CreditCard,
  Users,
  ShieldCheck,
  UserCog,
  Lock,
  Wifi,
  Puzzle,
  Bell,
  Rocket,
  ImageIcon,
  Landmark,
  Keyboard,
  LifeBuoyIcon,
  LayoutTemplate,
  Globe,
  Handshake,
  GraduationCap,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/companies", icon: Building2, label: "Empresas" },
  { href: "/admin/users", icon: Users, label: "Usuários" },
  { href: "/admin/roles", icon: UserCog, label: "Funções" },
  { href: "/admin/permissions", icon: Lock, label: "Permissões" },
  { href: "/admin/stars", icon: Star, label: "Stars" },
  { href: "/admin/plans", icon: CreditCard, label: "Planos" },
  { href: "/admin/instances", icon: Wifi, label: "Instâncias" },
  { href: "/admin/apps", icon: Puzzle, label: "Apps" },
  { href: "/admin/notifications", icon: Bell, label: "Notificações" },
  { href: "/admin/space-points", icon: Rocket, label: "Space Points" },
  { href: "/admin/assets", icon: ImageIcon, label: "Padrão Visual" },
  { href: "/admin/payments", icon: Landmark, label: "Gateways" },
  { href: "/admin/partners", icon: Handshake, label: "Parceiros" },
  { href: "/admin/moderators", icon: ShieldCheck, label: "Moderadores" },
  { href: "/admin/patterns", icon: LayoutTemplate, label: "Padrões NASA" },
  { href: "/admin/space-help", icon: GraduationCap, label: "Space Help" },
  { href: "/admin/space_station", icon: Globe, label: "Space Station" },
  { href: "/admin/atalhos", icon: Keyboard, label: "Atalhos" },
  { href: "/admin/support", icon: LifeBuoyIcon, label: "Suporte" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  // Fecha o drawer mobile ao trocar de rota
  React.useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  const handleClick = React.useCallback(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-zinc-800">
      <SidebarHeader className="bg-zinc-900 border-b border-zinc-800 px-5 py-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-violet-400 shrink-0" />
          <span className="text-sm font-bold tracking-wide text-white">
            NASA Admin
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-zinc-900 px-2 py-4">
        <SidebarGroup className="p-0">
          <SidebarMenu className="gap-0.5">
            {NAV.map(({ href, icon: Icon, label }) => {
              const active =
                href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(href);
              return (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={label}
                    className={cn(
                      "h-9 text-sm",
                      active
                        ? "bg-violet-600/20 text-violet-300 data-[active=true]:bg-violet-600/20 data-[active=true]:text-violet-300 hover:bg-violet-600/25 hover:text-violet-200"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-white",
                    )}
                  >
                    <Link href={href} onClick={handleClick}>
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-zinc-900 border-t border-zinc-800 px-4 py-4">
        <p className="text-[10px] uppercase tracking-widest text-zinc-600">
          Painel Restrito
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
