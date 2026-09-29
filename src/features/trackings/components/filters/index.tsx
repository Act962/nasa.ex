"use client";

import { Button } from "@/components/ui/button";
import { AstroCommandButton } from "@/features/astro-commander/components/astro-command-button";
import { ASTRO_COMMAND_EXAMPLES } from "@/features/astro-commander/lib/command-examples";
import {
  ChevronsLeft,
  ChevronsRight,
  PlusIcon,
  SlidersHorizontal,
  SparklesIcon,
} from "lucide-react";
import { useState } from "react";
import { TrackingSwitcher } from "./tracking-switcher";
import { ParticipantsSwitcher } from "./participant-switcher";
import { Filters } from "./filters";
import { TagsFilter } from "./tags-filter";
import { CalendarFilter } from "./calendar-filter";
import { useParams } from "next/navigation";
import AddLeadSheet from "@/features/trackings/components/modal/add-lead-sheet";
import { BoardCustomizeSheet } from "@/features/trackings/components/modal/board-customize-sheet";
import { AiLeadButton } from "@/features/trackings/components/modal/ai-lead-button";
import { useAddLead } from "@/hooks/modal/use-add-lead";
import { useCanCustomizeBoard } from "../../hooks/use-can-customize-board";
import { WorkspacesSwitcher } from "./workspaces-switcher";
import { useKanbanStore } from "../../lib/kanban-store";
import { cn } from "@/lib/utils";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function FiltersTracking() {
  const { trackingId } = useParams<{ trackingId: string }>();
  const useLeadSheet = useAddLead();
  const canCustomizeBoard = useCanCustomizeBoard(trackingId);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const collapsed = useKanbanStore((s) => s.headerCollapsed);
  const toggleCollapsed = useKanbanStore((s) => s.toggleHeaderCollapsed);

  return (
    <>
      <div
        className={cn(
          "flex justify-between items-center px-4 py-2 gap-2 border-b border-border mb-2",
        )}
      >
        <div className="flex items-center gap-x-2">
          {!collapsed && (
            <div className="hidden md:flex items-center gap-x-2">
              <TrackingSwitcher />
              <ParticipantsSwitcher />
              <TagsFilter />
              <WorkspacesSwitcher />
              <CalendarFilter />
              {/* <SorterLead /> */}
            </div>
          )}
        </div>

        {/* Lado direito: toggle + Filtros + IA de Leads + Novo Lead.
            Toggle e Filtros ficam SEMPRE visíveis; IA de Leads esconde
            quando recolhido. */}
        <div className="flex items-center gap-2">
          <AstroCommandButton
            examples={ASTRO_COMMAND_EXAMPLES.tracking}
            className="hidden md:inline-flex"
          />
          <AstroCommandButton
            examples={ASTRO_COMMAND_EXAMPLES.tracking}
            compact
            className="size-8 md:hidden"
          />
          {/* Botão de recolher/expandir */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={toggleCollapsed}
                aria-label={
                  collapsed ? "Expandir cabeçalho" : "Recolher cabeçalho"
                }
              >
                {collapsed ? (
                  <ChevronsRight className="size-4" />
                ) : (
                  <ChevronsLeft className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {collapsed ? "Expandir cabeçalho" : "Recolher cabeçalho"}
            </TooltipContent>
          </Tooltip>

          {/* Filtros — sempre visível, mesmo recolhido. */}
          <Filters />

          {canCustomizeBoard && !collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomizeOpen(true)}
                  aria-label="Personalizar board"
                  data-guide={GUIDE_ANCHORS.boardCustomizeButton.id}
                >
                  <SlidersHorizontal className="size-4" />
                  <span className="hidden lg:inline">Personalizar</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Personalizar campos do board</TooltipContent>
            </Tooltip>
          )}

          {!collapsed && (
            <AiLeadButton trackingId={trackingId}>
              <Button variant="outline" size="icon-sm">
                <SparklesIcon className="size-4 text-purple-500" />
                {/* <span className="bg-linear-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent font-semibold">
                  Agente de Automações
                </span> */}
              </Button>
            </AiLeadButton>
          )}

          <Button
            size="sm"
            onClick={() => useLeadSheet.setIsOpen(true)}
            data-guide={GUIDE_ANCHORS.boardNewLeadButton.id}
          >
            <PlusIcon className="size-4" />
            Novo Lead
          </Button>
        </div>
      </div>

      <AddLeadSheet
        trackingId={trackingId}
        open={useLeadSheet.isOpen}
        onOpenChange={useLeadSheet.setIsOpen}
      />

      {canCustomizeBoard && (
        <BoardCustomizeSheet
          trackingId={trackingId}
          open={customizeOpen}
          onOpenChange={setCustomizeOpen}
        />
      )}
    </>
  );
}
