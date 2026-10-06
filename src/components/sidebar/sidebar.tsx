"use client";

import * as React from "react";
import { GraduationCap, GripVertical } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { TeamSwitcher } from "./team-switcher";

import { NavUser } from "./nav-user";
import { NotificationBell } from "./notification-bell";
import { NavMenu } from "./nav-menu";
import { ICON_MODE_BUTTON, ICON_MODE_LABEL } from "./icon-mode";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { WorkspacesItems } from "./workspaces-items";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

// Editor de sites (/pages/<id>) é imersivo: o menu do app sai de cena e o editor ocupa a tela toda.
const IMMERSIVE_EDITOR_PATH_PATTERN = /^\/pages\/(?!templates$)[^/]+$/;

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname]);

  // Estado em vez de ref: no celular a lista só monta quando a gaveta abre, e o efeito precisa saber disso.
  const [appsScrollArea, setAppsScrollArea] = React.useState<HTMLDivElement | null>(null);
  const hasMoreAppsBelow = useHasMoreBelow(appsScrollArea);

  const currentOrganization = mounted
    ? session?.session.activeOrganizationId
    : undefined;

  if (IMMERSIVE_EDITOR_PATH_PATTERN.test(pathname)) return null;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher />
      </SidebarHeader>
      {/* O shadcn tira o scroll no modo recolhido (`overflow-hidden`); com o nome
          embaixo de cada ícone, muitos apps passavam da tela e sumiam. */}
      <SidebarContent
        ref={setAppsScrollArea}
        className="group-data-[collapsible=icon]:overflow-auto group-data-[collapsible=icon]:overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <NavMenu />
        <SidebarSeparator className="mx-0" />
        {currentOrganization && <WorkspacesItems />}
      </SidebarContent>
      {/* Sombra na borda de baixo da lista: avisa que há mais apps instalados rolando. */}
      <div aria-hidden className="pointer-events-none relative h-0">
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-sidebar via-sidebar/70 to-transparent transition-opacity duration-300",
            hasMoreAppsBelow ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "absolute inset-x-2 bottom-0 h-px shadow-[0_-6px_14px_2px_rgba(0,0,0,0.18)] transition-opacity duration-300",
            hasMoreAppsBelow ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
      <SidebarFooter>
        <SidebarMenu>
          <NotificationBell />
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={"Space Help"}
              asChild
              className={ICON_MODE_BUTTON}
            >
              <Link href="/space-help">
                <GraduationCap className="size-4" />
                <span className={ICON_MODE_LABEL}>Space Help</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser />
      </SidebarFooter>
      <SidebarRail className="flex items-center justify-center group/rail">
        <div
          className={cn(
            "relative opacity-0 group-hover/rail:opacity-100 cursor-pointer",
            buttonVariants({
              size: "icon-xs",
              variant: "secondary",
            }),
          )}
        >
          <GripVertical className="size-4" />
        </div>
      </SidebarRail>
    </Sidebar>
  );
}

/** Verdadeiro enquanto a área rolável ainda tem conteúdo escondido embaixo. */
function useHasMoreBelow(scrollArea: HTMLDivElement | null) {
  const [hasMoreBelow, setHasMoreBelow] = React.useState(false);

  React.useEffect(() => {
    if (!scrollArea) return;
    const updateHasMoreBelow = () => {
      setHasMoreBelow(scrollArea.scrollTop + scrollArea.clientHeight < scrollArea.scrollHeight - 4);
    };
    const resizeObserver = new ResizeObserver(updateHasMoreBelow);
    const observeChildren = () => Array.from(scrollArea.children).forEach((child) => resizeObserver.observe(child));
    resizeObserver.observe(scrollArea);
    observeChildren();
    // Apps e workspaces chegam depois (carregam da API): novos blocos também entram na conta.
    const mutationObserver = new MutationObserver(() => {
      observeChildren();
      updateHasMoreBelow();
    });
    mutationObserver.observe(scrollArea, { childList: true });
    scrollArea.addEventListener("scroll", updateHasMoreBelow, { passive: true });
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      scrollArea.removeEventListener("scroll", updateHasMoreBelow);
    };
  }, [scrollArea]);

  return hasMoreBelow;
}
