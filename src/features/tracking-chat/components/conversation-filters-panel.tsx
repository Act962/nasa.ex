"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { XIcon } from "lucide-react";
import { ParticipantsSwitcher } from "@/features/trackings/components/filters/participant-switcher";
import { StatusFlowFilter } from "@/features/trackings/components/filters/status-flow-filter";
import { TemperatureFilter } from "@/features/trackings/components/filters/temperature-filter";
import { ConversationSorter } from "./conversation-sorter";
import { useConversationFilters } from "../hooks/use-conversation-filters";

interface ConversationFiltersPanelProps {
  trackingId: string | null;
  /** Botão que abre o painel — pill no desktop, tab no mobile. */
  trigger: ReactNode;
}

/**
 * Painel de filtros avançados da lista de conversas (spec 0011).
 *
 * O gatilho vem de fora justamente pra que desktop e mobile compartilhem
 * este conteúdo sem duplicar a marcação — só a aparência do botão muda.
 *
 * Responsável, Temperatura e Status são os componentes do board, sem
 * cópia: eles leem e escrevem as mesmas chaves de URL (D-3). A ordenação
 * é própria do chat, porque tem direção e o board não tem (D-5).
 *
 * `modal={false}` é necessário, não estético: cada controle interno abre
 * o próprio popover/dropdown, e o modo modal prenderia o foco no painel,
 * impedindo a interação com esses filhos.
 */
export function ConversationFiltersPanel({
  trackingId,
  trigger,
}: ConversationFiltersPanelProps) {
  const {
    sortBy,
    sortDirection,
    setSortBy,
    setSortDirection,
    activeCount,
    clearAll,
  } = useConversationFilters();

  return (
    <Popover modal={false}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="w-64 p-2"
      >
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="text-xs font-medium text-muted-foreground">
            Filtrar conversas
          </span>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1 rounded-sm px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <XIcon className="size-3" />
              Limpar
            </button>
          )}
        </div>

        {/* `[&>button]:w-full` estica os controles do board, que nascem com
            largura automática pra viver numa toolbar horizontal. */}
        <div className="flex flex-col gap-1 [&>button]:w-full [&>div>button]:w-full">
          <ParticipantsSwitcher trackingId={trackingId} />
          <TemperatureFilter />
          <StatusFlowFilter />
          <ConversationSorter
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSortByChange={setSortBy}
            onSortDirectionChange={setSortDirection}
            className="w-full justify-start"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
