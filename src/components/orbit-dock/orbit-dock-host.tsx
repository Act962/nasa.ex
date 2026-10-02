"use client";

import { AstroSymbolIcon } from "@/components/astro-symbol-icon";
import { usePathname } from "next/navigation";
import { CalendarIcon, KanbanIcon, MessageSquareTextIcon } from "lucide-react";
import { OrbitDock } from "./orbit-dock";
import { useOrbitDockStore, type OrbitDockConfig } from "./orbit-dock-store";
import { useCollapseOrbitDockOnScroll } from "./use-collapse-orbit-dock-on-scroll";

function isPathActive(pathname: string, basePath: string) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function buildDefaultConfig(pathname: string): OrbitDockConfig {
  return {
    leftItems: [
      { label: "Início", href: "/home?home=1", icon: <AstroSymbolIcon />, isActive: pathname === "/home" },
      { label: "Trackings", href: "/tracking", icon: <KanbanIcon />, isActive: isPathActive(pathname, "/tracking") },
    ],
    rightItems: [
      { label: "Chats", href: "/tracking-chat", icon: <MessageSquareTextIcon />, isActive: isPathActive(pathname, "/tracking-chat") },
      { label: "Agenda", href: "/agendas", icon: <CalendarIcon />, isActive: isPathActive(pathname, "/agendas") },
    ],
  };
}

// Telas com composer próprio no rodapé: o dock nem chega a renderizar (sem piscar antes da hidratação).
const PATHS_WITHOUT_DOCK = ["/home"];

/** Montado uma vez no layout da plataforma: garante o dock em todas as telas do celular. */
export function OrbitDockHost() {
  const pathname = usePathname();
  const registeredConfig = useOrbitDockStore((state) => state.config);
  const isHiddenByScreen = useOrbitDockStore((state) => state.isHidden);
  const isHidden = isHiddenByScreen || PATHS_WITHOUT_DOCK.includes(pathname);
  const config = registeredConfig ?? buildDefaultConfig(pathname);
  useCollapseOrbitDockOnScroll(isHidden);

  return (
    <>
      <OrbitDock
        leftItems={config.leftItems}
        rightItems={config.rightItems}
        centerAction={config.centerAction}
        isHidden={isHidden}
      />
    </>
  );
}
