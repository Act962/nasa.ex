"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent hideOverlay>
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>
            Aplique filtros para refinar sua busca.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2 px-4">
          <ParticipantsSwitcher trackingId={trackingId} />
          <TemperatureFilter />
          <StatusFlowFilter />
          <ConversationSorter
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSortByChange={setSortBy}
            onSortDirectionChange={setSortDirection}
          />

          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 justify-start"
              onClick={clearAll}
            >
              <XIcon className="size-3.5" />
              Limpar filtros
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
