"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { TeamSwitcher } from "./team-switcher";

import { NavUser } from "./nav-user";
import { NavMenu } from "./nav-menu";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { usePathname } from "next/navigation";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();

  React.useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMenu />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail className="flex items-center justify-center group/rail">
        <div
          className={cn(
            "relative opacity-0 group-hover/rail:opacity-100 cursor-pointer",
            buttonVariants({
              size: "icon-xs",
              variant: "secondary",
            })
          )}
        >
          <GripVertical className="size-4" />
        </div>
      </SidebarRail>
    </Sidebar>
  );
}
