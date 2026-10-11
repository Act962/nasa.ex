"use client";

import { NodeToolbar, Position } from "@xyflow/react";
import { CopyIcon, LogInIcon, LogOutIcon, PlusIcon, SettingsIcon, TrashIcon } from "lucide-react";
import { Button } from "./ui/button";

interface WorkflowNodeProps {
  children: React.ReactNode;
  showToolbar?: boolean;
  onDelete?: () => void;
  onSettings?: () => void;
  /** Duplica o nó (mesmo type + data + offset de posição). */
  onDuplicate?: () => void;
  /** Abre o NodeSelector pra criar um próximo nó conectado a este. */
  onAddNext?: () => void;
  /** Gira o lado do quadro em que a ligação de entrada chega. */
  onCycleInputSide?: () => void;
  /** Gira o lado do quadro de onde a ligação de saída parte. */
  onCycleOutputSide?: () => void;
  name?: string;
  description?: string;
  /** Resumo curto embaixo do nome (ex.: as tags do gatilho), na visão de ícones. */
  caption?: React.ReactNode;
  /** Erro ou aviso previsto para este quadro, mostrado junto do nome até a correção (spec 0090). */
  notice?: WorkflowNodeNotice;
}

export interface WorkflowNodeNotice {
  severity: "error" | "warning";
  title: string;
  message: string;
  fixHint?: string;
}

export function WorkflowNode({
  children,
  name,
  showToolbar = true,
  onDelete,
  onSettings,
  onDuplicate,
  onAddNext,
  onCycleInputSide,
  onCycleOutputSide,
  caption,
  notice,
}: WorkflowNodeProps) {
  return (
    <>
      {showToolbar && (
        <NodeToolbar>
          <Button
            size="sm"
            variant="ghost"
            onClick={onSettings}
            title="Configurar"
          >
            <SettingsIcon className="size-4" />
          </Button>
          {onDuplicate && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDuplicate}
              title="Duplicar"
            >
              <CopyIcon className="size-4" />
            </Button>
          )}
          {onAddNext && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onAddNext}
              title="Criar próximo nó"
            >
              <PlusIcon className="size-4" />
            </Button>
          )}
          {onCycleInputSide && (
            <Button size="sm" variant="ghost" className="md:hidden" onClick={onCycleInputSide} title="Mudar o lado da entrada">
              <LogInIcon className="size-4" />
            </Button>
          )}
          {onCycleOutputSide && (
            <Button size="sm" variant="ghost" className="md:hidden" onClick={onCycleOutputSide} title="Mudar o lado da saída">
              <LogOutIcon className="size-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            title="Excluir"
          >
            <TrashIcon className="size-4" />
          </Button>
        </NodeToolbar>
      )}
      {children}
      {name && (
        <NodeToolbar
          position={Position.Bottom}
          isVisible
          className={notice ? "max-w-60 text-center" : "max-w-50 text-center"}
        >
          <p className="font-medium">{name}</p>
          {caption}
          {notice && (
            <div
              className={
                notice.severity === "error"
                  ? "mt-1.5 w-56 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-left text-[11px] leading-snug"
                  : "mt-1.5 w-56 rounded-lg border border-warning/40 bg-warning/10 px-2.5 py-2 text-left text-[11px] leading-snug"
              }
            >
              <p className={notice.severity === "error" ? "font-semibold text-destructive" : "font-semibold text-warning"}>
                {notice.title}
              </p>
              <p className="text-foreground/90">{notice.message}</p>
              {notice.fixHint && onSettings && (
                <button type="button" onClick={onSettings} className="mt-1 font-semibold text-primary hover:underline">
                  {notice.fixHint}
                </button>
              )}
            </div>
          )}
        </NodeToolbar>
      )}
    </>
  );
}
