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
import { useCallback } from "react";
import { toast } from "sonner";
import {
  wsExecutionNodes,
  wsTriggerNodes,
  WsNodeTypeOption,
} from "@/features/workspace-executions/lib/node-options";

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
              {wsTriggerNodes.map((nodeType) => {
                const Icon = nodeType.icon;
                return (
                  <div
                    key={nodeType.type}
                    className="w-full justify-start h-auto py-5 px-4 rounded-none cursor-pointer border-l-2 border-transparent hover:border-l-primary"
                    onClick={() => handleSelect(nodeType)}
                  >
                    <div className="flex items-center gap-6 w-full overflow-hidden">
                      {typeof Icon === "string" ? (
                        <img
                          src={Icon}
                          alt={nodeType.label}
                          className="size-5 object-contain rounded-sm"
                        />
                      ) : (
                        <Icon className="size-5" />
                      )}
                      <div className="flex flex-col items-start text-left">
                        <span className="font-medium text-sm">
                          {nodeType.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {nodeType.description}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="execution">
            <AccordionTrigger className="px-4 pt-5 hover:no-underline">
              Ações
            </AccordionTrigger>
            <AccordionContent>
              {wsExecutionNodes.map((nodeType) => {
                const Icon = nodeType.icon;
                return (
                  <div
                    key={nodeType.type}
                    className="w-full justify-start h-auto py-5 px-4 rounded-none cursor-pointer border-l-2 border-transparent hover:border-l-primary"
                    onClick={() => handleSelect(nodeType)}
                  >
                    <div className="flex items-center gap-6 w-full overflow-hidden">
                      {typeof Icon === "string" ? (
                        <img
                          src={Icon}
                          alt={nodeType.label}
                          className="size-5 object-contain rounded-sm"
                        />
                      ) : (
                        <Icon className="size-5" />
                      )}
                      <div className="flex flex-col items-start text-left">
                        <span className="font-medium text-sm">
                          {nodeType.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {nodeType.description}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SheetContent>
    </Sheet>
  );
}
