"use client";

import { NodeType } from "@/generated/prisma/enums";
import { createId } from "@paralleldrive/cuid2";
import { useReactFlow } from "@xyflow/react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCallback } from "react";
import { toast } from "sonner";
import {
  wsExecutionNodes,
  wsTriggerNodes,
  WsNodeTypeOption,
} from "@/features/workspace-executions/lib/node-options";

/** Card quadrado de node — mesmo padrão do node-selector principal. */
function WsNodeCard({
  node,
  onClick,
}: {
  node: WsNodeTypeOption;
  onClick: () => void;
}) {
  const Icon = node.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className="group flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg border bg-background p-2 transition-all hover:border-primary hover:bg-accent/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {typeof Icon === "string" ? (
            <img
              src={Icon}
              alt={node.label}
              className="size-6 object-contain rounded-sm"
            />
          ) : (
            <Icon className="size-6 text-foreground group-hover:text-primary transition-colors" />
          )}
          <span className="text-[11px] font-medium leading-tight text-center line-clamp-2">
            {node.label}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px]">
        <p className="text-xs">{node.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId?: string;
  children?: React.ReactNode;
}

export function WsNodeSelector({ open, onOpenChange, sourceId, children }: Props) {
  const { setNodes, getNodes, setEdges, screenToFlowPosition } = useReactFlow();

  const handleSelect = useCallback(
    (selection: WsNodeTypeOption) => {
      if (selection.category === "trigger") {
        const hasTrigger = getNodes().some((n) =>
          wsTriggerNodes.some((t) => t.type === n.type),
        );
        if (hasTrigger) {
          toast.error("Apenas um gatilho é permitido por workflow.");
          return;
        }
      }

      const newId = createId();
      setNodes((nodes) => {
        const hasInitial = nodes.some(
          (n) => n.type === NodeType.WS_INITIAL,
        );
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const pos = screenToFlowPosition({
          x: centerX + (Math.random() - 0.5) * 200,
          y: centerY + (Math.random() - 0.5) * 200,
        });
        const newNode = {
          id: newId,
          data: {},
          position: pos,
          type: selection.type,
        };
        return hasInitial ? [newNode] : [...nodes, newNode];
      });

      if (sourceId) {
        setEdges((edges) => [
          ...edges,
          {
            id: createId(),
            source: sourceId,
            target: newId,
            sourceHandle: "source-1",
            targetHandle: "target-1",
          },
        ]);
      }

      onOpenChange(false);
    },
    [setNodes, getNodes, setEdges, sourceId, screenToFlowPosition, onOpenChange],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {children && <SheetTrigger asChild>{children}</SheetTrigger>}
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Automações do Workspace</SheetTitle>
          <SheetDescription>
            Selecione o tipo de nó para adicionar.
          </SheetDescription>
        </SheetHeader>
        <TooltipProvider delayDuration={300}>
          <Accordion
            type="multiple"
            defaultValue={["trigger", "execution"]}
            className="w-full"
          >
            <AccordionItem value="trigger">
              <AccordionTrigger className="px-4 pt-5 hover:no-underline">
                Gatilhos
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-4 gap-2 px-4 pb-2">
                  {wsTriggerNodes.map((nodeType) => (
                    <WsNodeCard
                      key={nodeType.type}
                      node={nodeType}
                      onClick={() => handleSelect(nodeType)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="execution">
              <AccordionTrigger className="px-4 pt-5 hover:no-underline">
                Ações
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-4 gap-2 px-4 pb-2">
                  {wsExecutionNodes.map((nodeType) => (
                    <WsNodeCard
                      key={nodeType.type}
                      node={nodeType}
                      onClick={() => handleSelect(nodeType)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  );
}
