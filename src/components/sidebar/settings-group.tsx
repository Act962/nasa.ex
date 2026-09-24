"use client";

import { ChevronRight, CircleQuestionMarkIcon, Map, Settings } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useTour } from "@/features/tour/context";
import { NASA_TOUR_STEPS } from "@/features/tour/steps";
import { StarsMeter } from "./stars-meter";
import { TokenMeter } from "./token-meter";

/**
 * Stars, Tokens, Tour Guiado e Suporte moram aqui.
 *
 * Soltos no rodapé eles ocupavam quatro linhas permanentes, empurrando o
 * menu e competindo com os apps. Agrupados, o rodapé volta a caber.
 *
 * No modo ícone o grupo não existe: sem rótulo para ler, esconder os
 * quatro atrás de mais um clique só tiraria acesso.
 */
export function SettingsGroup() {
  const { state } = useSidebar();
  const { startTour } = useTour();
  const [isOpen, setIsOpen] = useState(false);

  const isIconMode = state === "collapsed";

  const items = (
    <>
      <StarsMeter />
      <TokenMeter />
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
          <SidebarMenuButton tooltip="Suporte" asChild>
            <Link href="/support">
              <CircleQuestionMarkIcon className="size-4" />
              <span>Suporte</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  );

  if (isIconMode) return items;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="group/collapsible">
      <SidebarMenu>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              tooltip="Configurações"
              className="text-muted-foreground hover:text-foreground"
            >
              <Settings className="size-4" />
              <span>Configurações</span>
              <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
        </SidebarMenuItem>
      </SidebarMenu>
      <CollapsibleContent>
        <div className="ml-3 border-l border-sidebar-border pl-1">{items}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
