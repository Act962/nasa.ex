"use client";

import { NodeToolbar, Position } from "@xyflow/react";
import { CopyIcon, PlusIcon, SettingsIcon, TrashIcon } from "lucide-react";
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
  name?: string;
  description?: string;
}

export function WorkflowNode({
  children,
  name,
  showToolbar = true,
  onDelete,
  onSettings,
  onDuplicate,
  onAddNext,
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
          className="max-w-50 text-center"
        >
          <p className="font-medium">{name}</p>
        </NodeToolbar>
      )}
    </>
  );
}
