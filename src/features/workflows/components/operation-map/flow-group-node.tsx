"use client";

import Link from "next/link";
import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ExternalLinkIcon, PencilIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { outlineToneColor } from "@/features/editor/components/rich/animated-outline";
import { useUpdateWorkflowIsActive } from "@/features/workflows/hooks/use-workflows";
import { cn } from "@/lib/utils";
import { StageChip } from "./stage-chip";

// Retângulo de um fluxo no mapa da operação (spec 0092): nome em cima, etapa do funil, estado e
// os passos dentro. Vermelho quando o fluxo tem erro previsto.

export interface FlowGroupData extends Record<string, unknown> {
  workflowId: string;
  trackingId: string;
  name: string;
  folderName: string | null;
  isActive: boolean;
  errorCount: number;
  firstErrorTitle: string | null;
  /** Fluxo de um trecho só: a etiqueta fica aqui. Com mais trechos, cada moldura tem a sua. */
  singleStage: { trackingId: string | null; statusId: string | null } | null;
  isEmpty: boolean;
  /** A pessoa pode editar Automações: sem isso o interruptor de ligar fica travado. */
  canToggle: boolean;
  /** Etapa 2 (interruptor ligado): dá para ligar este fluxo em outro pelo mapa. */
  canLink: boolean;
  /** Fluxos do mesmo funil para onde este pode seguir. */
  linkTargets: { id: string; name: string }[];
  onLinkTo?: (toWorkflowId: string) => void;
  /** Abre o fluxo para edição por cima do mapa. Ausente, o botão leva à página do fluxo. */
  onEdit?: () => void;
}

export type FlowGroupNodeType = Node<FlowGroupData, "flowGroup">;

export const FlowGroupNode = memo(function FlowGroupNode({ data }: NodeProps<FlowGroupNodeType>) {
  const updateIsActive = useUpdateWorkflowIsActive(data.trackingId);
  const hasError = data.errorCount > 0;
  const toneColor = outlineToneColor(hasError ? "problem" : "ok");
  const editorHref = `/tracking/${data.trackingId}/workflows/${data.workflowId}`;

  const handleToggle = (shouldActivate: boolean) => {
    // Mesma trava do editor: com erro previsto o fluxo não liga; desligar é sempre permitido.
    if (shouldActivate && hasError) {
      toast.error("Corrija os pontos em vermelho antes de ligar", { description: data.firstErrorTitle ?? undefined });
      return;
    }
    updateIsActive.mutate({ workflowId: data.workflowId, isActive: shouldActivate });
  };

  return (
    <div
      className="orbita-map-group group/flow size-full rounded-3xl border-[3px] border-dashed bg-card/40"
      style={{ borderColor: toneColor }}
    >
      {/* Entrada e saída do fluxo. Com a etapa 2 ligada, arrastar da saída até outro retângulo liga os dois. */}
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={data.canLink}
        className="!size-3.5 !border-2 !border-white"
        style={{ backgroundColor: toneColor }}
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={data.canLink}
        className="!size-3.5 !border-2 !border-white"
        style={{ backgroundColor: toneColor }}
      />
      {data.canLink && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Continuar depois deste fluxo"
              title="Continuar depois deste fluxo"
              className="nodrag nopan absolute -right-10 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-info text-white shadow-md transition-transform hover:scale-110"
            >
              <PlusIcon className="size-4" strokeWidth={3} />
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" align="center" className="w-64 p-2 text-sm">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Depois deste fluxo</p>
            <button type="button" onClick={data.onEdit} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-muted">
              Adicionar um passo
              <span className="block text-xs text-muted-foreground">Abre o fluxo para editar, sem sair do mapa</span>
            </button>
            <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Seguir para outro fluxo</p>
            {data.linkTargets.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">Não há outro fluxo neste funil.</p>}
            <div className="max-h-56 overflow-y-auto">
              {data.linkTargets.map((linkTarget) => (
                <button
                  key={linkTarget.id}
                  type="button"
                  className="block w-full truncate rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                  onClick={() => data.onLinkTo?.(linkTarget.id)}
                >
                  {linkTarget.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      <div className="flex items-start gap-3 px-5 pt-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight" style={{ color: hasError ? "var(--destructive)" : "var(--info)" }} title={data.name}>
            {data.name}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {data.singleStage && (
              <StageChip ownTrackingId={data.trackingId} trackingId={data.singleStage.trackingId} statusId={data.singleStage.statusId} />
            )}
            {data.folderName && <span className="truncate rounded-full bg-muted px-2 py-0.5 text-[10.5px] text-muted-foreground">{data.folderName}</span>}
            {hasError && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10.5px] font-medium text-destructive" title={data.firstErrorTitle ?? undefined}>
                <TriangleAlertIcon className="size-3" />
                {data.errorCount === 1 ? "1 problema" : `${data.errorCount} problemas`}
              </span>
            )}
          </div>
        </div>
        <div className="nodrag nopan flex shrink-0 items-center gap-2">
          <span className={cn("text-[11px]", data.isActive ? "font-medium text-success" : "text-muted-foreground")}>{data.isActive ? "Ativo" : "Inativo"}</span>
          <Switch
            checked={data.isActive}
            disabled={updateIsActive.isPending || !data.canToggle}
            onCheckedChange={handleToggle}
            aria-label={data.isActive ? "Desligar o fluxo" : "Ligar o fluxo"}
          />
          {data.onEdit && (
            <button
              type="button"
              onClick={data.onEdit}
              className="grid size-7 place-items-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
              title="Editar o fluxo aqui, sem sair do mapa"
              aria-label="Editar o fluxo aqui, sem sair do mapa"
            >
              <PencilIcon className="size-3.5" />
            </button>
          )}
          <Link
            href={editorHref}
            className="grid size-7 place-items-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
            title="Abrir o fluxo para editar"
            aria-label="Abrir o fluxo para editar"
          >
            <ExternalLinkIcon className="size-3.5" />
          </Link>
        </div>
      </div>
      {data.isEmpty && <p className="px-5 pt-3 text-xs text-muted-foreground">Fluxo ainda sem passos. Abra para montar.</p>}
    </div>
  );
});
