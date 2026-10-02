"use client";

import { Button } from "@/components/ui/button";
import { AstroCommandButton } from "@/features/astro-commander/components/astro-command-button";
import { ASTRO_COMMAND_EXAMPLES } from "@/features/astro-commander/lib/command-examples";
import {
  ChevronsLeft,
  ChevronsRight,
  PlusIcon,
  Search,
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
import { useSearchModal } from "@/hooks/modal/use-search-modal";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function FiltersTracking() {
  const { trackingId } = useParams<{ trackingId: string }>();
  const useLeadSheet = useAddLead();
  const searchLead = useSearchModal();
  const canCustomizeBoard = useCanCustomizeBoard(trackingId);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const collapsed = useKanbanStore((s) => s.headerCollapsed);
  const toggleCollapsed = useKanbanStore((s) => s.toggleHeaderCollapsed);

  return (
    <>
      <div
        className={cn(
          "flex justify-between items-center gap-2 mb-2 px-3 py-2 lg:px-4",
        )}
      >
        {/* Celular: busca ocupa a linha; filtros moram no "Personalizar board". */}
        <InputGroup
          className="h-10 min-w-0 flex-1 lg:hidden"
          onClick={() => searchLead.setIsOpen(true)}
        >
          <InputGroupInput placeholder="Pesquisar..." readOnly />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>

        <div className="hidden lg:flex items-center gap-x-2">
          {!collapsed && (
            <div className="flex items-center gap-x-2">
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
            className="hidden lg:inline-flex"
          />
          {/* Botão de recolher/expandir */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden size-8 shrink-0 lg:inline-flex"
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

          {/* Filtros — sempre visível no desktop, mesmo recolhido. */}
          <div className="hidden lg:contents">
            <Filters />
          </div>

          <Button
            variant="outline"
            size="icon"
            className="size-10 shrink-0 lg:hidden"
            onClick={() => setCustomizeOpen(true)}
            aria-label="Personalizar board e filtros"
            data-guide={GUIDE_ANCHORS.boardCustomizeButton.id}
          >
            <SlidersHorizontal className="size-4" />
          </Button>

          {canCustomizeBoard && !collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden lg:inline-flex"
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
              <Button variant="outline" size="icon-sm" className="hidden lg:inline-flex">
                <SparklesIcon className="size-4 text-info" />
                {/* <span className="bg-linear-to-r from-info to-info bg-clip-text text-transparent font-semibold">
                  Agente de Automações
                </span> */}
              </Button>
            </AiLeadButton>
          )}

          <Button
            size="sm"
            className="hidden lg:inline-flex"
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

      <BoardCustomizeSheet
        trackingId={trackingId}
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        canCustomize={canCustomizeBoard}
      />
    </>
  );
}
