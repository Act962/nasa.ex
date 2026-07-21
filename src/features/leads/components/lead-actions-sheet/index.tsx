"use client";

import { useMemo, useState } from "react";
import { Columns3Icon, ListIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CreateActionModal } from "@/features/actions/components/create-action-modal";
import { DataKanban } from "@/features/actions/components/data-kanban";
import { DataTable } from "@/features/actions/components/data-table";
import { useActionKanbanStore } from "@/features/actions/lib/kanban-store";
import { useWorkspaces } from "@/features/workspace/hooks/use-workspace";
import { useLeadActionCountsPatch } from "@/features/trackings/hooks/use-lead-action-counts";
import { useLeadActionsSheetStore } from "../../lib/lead-actions-sheet-store";
import { WorkspaceSelect } from "./workspace-select";

type SheetView = "kanban" | "list";

/**
 * Ações de um lead, abertas de baixo pra cima a partir do card no board.
 *
 * Reusa `DataKanban`/`DataTable` do workspace com `leadId` — as colunas são as
 * reais do workspace selecionado, só que filtradas pelas ações do lead. Um
 * workspace por vez: `Action.workspaceId` é obrigatório e cada workspace tem
 * seu próprio conjunto de colunas.
 *
 * Não renderiza `FiltersBar`/`FiltersSheet` de propósito: eles escrevem os
 * params `af_*` na URL, que aqui é a da página de tracking.
 */
export function LeadActionsSheet() {
  const lead = useLeadActionsSheetStore((state) => state.lead);
  const closeLeadActions = useLeadActionsSheetStore(
    (state) => state.closeLeadActions,
  );

  const isOpen = !!lead;
  const { workspaces, isLoading } = useWorkspaces(isOpen);

  // Override do usuário no seletor. O workspace efetivo é DERIVADO dele — sem
  // efeito de sincronização — pra não precisar resetar quando a lista carrega
  // ou quando o workspace escolhido some. Manter a escolha entre aberturas é
  // proposital: quem trabalha num workspace tende a continuar nele.
  const [workspaceOverride, setWorkspaceOverride] = useState<string | null>(
    null,
  );
  const [view, setView] = useState<SheetView>("kanban");
  const [isCreating, setIsCreating] = useState(false);

  const { applyDelta } = useLeadActionCountsPatch(lead?.trackingId ?? null);

  const workspaceOptions = useMemo(
    () =>
      workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        color: workspace.color,
      })),
    [workspaces],
  );

  const selectedWorkspaceId =
    workspaceOverride &&
    workspaceOptions.some((workspace) => workspace.id === workspaceOverride)
      ? workspaceOverride
      : (workspaceOptions[0]?.id ?? null);

  const onWorkspaceChange = (workspaceId: string) => {
    // Colunas diferentes reusam o mesmo store singleton — zerar evita um frame
    // com as ações do workspace anterior.
    useActionKanbanStore.getState().resetBoard();
    setWorkspaceOverride(workspaceId);
  };

  return (
    <>
      <Sheet
        open={isOpen}
        onOpenChange={(next) => {
          if (!next) closeLeadActions();
        }}
      >
        <SheetContent
          side="bottom"
          className="flex h-[90dvh] max-h-[90dvh] flex-col gap-0 p-0"
        >
          <SheetHeader className="shrink-0 gap-3 border-b px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <SheetTitle className="truncate text-base">
                  Ações de {lead?.leadName}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Ações vinculadas a este lead no workspace selecionado.
                </SheetDescription>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <WorkspaceSelect
                  workspaces={workspaceOptions}
                  isLoading={isLoading}
                  value={selectedWorkspaceId}
                  onChange={onWorkspaceChange}
                />

                <Tabs
                  value={view}
                  onValueChange={(next) => setView(next as SheetView)}
                >
                  <TabsList className="w-full sm:w-auto">
                    <TabsTrigger value="kanban" className="h-8 flex-1 sm:flex-none">
                      <Columns3Icon className="size-4" />
                      Kanban
                    </TabsTrigger>
                    <TabsTrigger value="list" className="h-8 flex-1 sm:flex-none">
                      <ListIcon className="size-4" />
                      Lista
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <Button
                  size="sm"
                  onClick={() => setIsCreating(true)}
                  disabled={!selectedWorkspaceId}
                >
                  <PlusIcon className="size-4" />
                  Nova ação
                </Button>
              </div>
            </div>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-hidden">
            {!selectedWorkspaceId ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                {isLoading
                  ? "Carregando workspaces..."
                  : "Crie ou entre em um workspace para vincular ações a este lead."}
              </div>
            ) : (
              lead && (
                <>
                  <div className={cn("h-full", view !== "kanban" && "hidden")}>
                    <DataKanban
                      workspaceId={selectedWorkspaceId}
                      leadId={lead.leadId}
                    />
                  </div>
                  <div
                    className={cn(
                      "h-full overflow-auto",
                      view !== "list" && "hidden",
                    )}
                  >
                    <DataTable
                      workspaceId={selectedWorkspaceId}
                      leadId={lead.leadId}
                    />
                  </div>
                </>
              )
            )}
          </div>
        </SheetContent>
      </Sheet>

      {selectedWorkspaceId && lead && (
        <CreateActionModal
          open={isCreating}
          onOpenChange={setIsCreating}
          workspaceId={selectedWorkspaceId}
          leadId={lead.leadId}
          onCreated={() => {
            applyDelta(lead.leadId, { total: 1 });
            setIsCreating(false);
          }}
        />
      )}
    </>
  );
}
