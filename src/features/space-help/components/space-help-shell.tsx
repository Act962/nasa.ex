"use client";

import { AstroSymbolIcon } from "@/components/astro-symbol-icon";
import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { GraduationCap, Route, Search } from "lucide-react";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { SPACE_HELP_SEARCH_INPUT_ID, SpaceHelpSidebarNav } from "./space-help-sidebar-nav";

const SPACE_HELP_HOME_PATH = "/space-help";
const SPACE_HELP_TRACKS_PATH = "/space-help/trilhas";

function focusSpaceHelpSearch() {
  const searchInput = document.getElementById(SPACE_HELP_SEARCH_INPUT_ID);
  searchInput?.scrollIntoView({ behavior: "smooth", block: "center" });
  searchInput?.focus({ preventScroll: true });
}

export function SpaceHelpShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";

  useRegisterOrbitDock({
    leftItems: [
      {
        label: "Space Help",
        icon: <GraduationCap />,
        href: SPACE_HELP_HOME_PATH,
        isActive: pathname === SPACE_HELP_HOME_PATH,
      },
      {
        label: "Rotas",
        icon: <Route />,
        href: SPACE_HELP_TRACKS_PATH,
        isActive: pathname.startsWith(SPACE_HELP_TRACKS_PATH),
      },
    ],
    rightItems: [
      { label: "Buscar", icon: <Search />, onSelect: focusSpaceHelpSearch },
      { label: "Início", icon: <AstroSymbolIcon />, href: "/home?home=1" },
    ],
  });

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-3.5rem)] bg-background">
      <SpaceHelpSidebarNav />
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
