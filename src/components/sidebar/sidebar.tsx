"use client";

import * as React from "react";
import { CircleQuestionMarkIcon, GripVertical, Map } from "lucide-react";

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
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { WorkspacesItems } from "./workspaces-items";
import { authClient } from "@/lib/auth-client";
import { useTour } from "@/features/tour/context";
import { NASA_TOUR_STEPS } from "@/features/tour/steps";
import Link from "next/link";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const { startTour } = useTour();

  React.useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname]);

  const currentOrganization = session?.session.activeOrganizationId;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMenu />
        <SidebarSeparator className="mx-0" />
        {currentOrganization && <WorkspacesItems />}
      </SidebarContent>
      <SidebarFooter>
        <NotificationBell />
        {/* Tour Guiado trigger */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Tour Guiado"
              onClick={() => startTour(NASA_TOUR_STEPS)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Map className="size-4" />
              <span>Tour Guiado</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={"Suporte"} asChild>
              <Link href="/support">
                <CircleQuestionMarkIcon className="size-4" />
                <span>Suporte</span>
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
