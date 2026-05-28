"use client";

import { NodeType } from "@/generated/prisma/enums";
import { createId } from "@paralleldrive/cuid2";
import { useReactFlow } from "@xyflow/react";

import {
  ArrowLeftRightIcon,
  CircleGaugeIcon,
  GlobeIcon,
  MousePointerIcon,
  SendIcon,
  TagIcon,
  TimerIcon,
  Trophy,
  UserPlusIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Separator } from "./ui/separator";
import { useCallback } from "react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  executionNodes,
  NodeTypeOption,
  triggerNodes,
} from "@/features/executions/lib/node-options";

/**
 * Card quadrado de node — ícone centralizado + label embaixo + tooltip com
 * descrição on hover. Substitui o layout de lista horizontal (linha por node)
 * que poluía visualmente. Grid 3 colunas mantém a Sheet enxuta.
 */
function NodeCard({
  node,
  onClick,
}: {
  node: NodeTypeOption;
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

interface NodeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId?: string;
  children?: React.ReactNode;
}

export function NodeSelector({
  open,
  onOpenChange,
  sourceId,
  children,
}: NodeSelectorProps) {
  const { setNodes, getNodes, setEdges, screenToFlowPosition } = useReactFlow();

  const handleNodeSelect = useCallback(
    (selection: NodeTypeOption) => {
      if (selection.category === "trigger") {
        const nodes = getNodes();
        const hasTrigger = nodes.some((node) =>
          triggerNodes.some((tn) => tn.type === node.type),
        );

        if (hasTrigger) {
          toast.error("Apenas um gatilho é permitido por workflow.");
          return;
        }
      }

      const newNodeId = createId();

      setNodes((nodes) => {
        const hasInitialTrigger = nodes.some(
          (node) => node.type === NodeType.INITIAL,
        );

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        const flowPostion = screenToFlowPosition({
          x: centerX + (Math.random() - 0.5) * 200,
          y: centerY + (Math.random() - 0.5) * 200,
        });

        const newNode = {
          id: newNodeId,
          data: {},
          position: flowPostion,
          type: selection.type,
        };

        if (hasInitialTrigger) {
          return [newNode];
        }

        return [...nodes, newNode];
      });

      if (sourceId) {
        setEdges((edges) => {
          return [
            ...edges,
            {
              id: createId(),
              source: sourceId,
              target: newNodeId,
              sourceHandle: "source-1",
              targetHandle: "target-1",
            },
          ];
        });
      }

      onOpenChange(false);
    },
    [setNodes, getNodes, onOpenChange, screenToFlowPosition],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {children && <SheetTrigger asChild>{children}</SheetTrigger>}
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Automações</SheetTitle>
          <SheetDescription>
            Selecione o tipo de automação que deseja adicionar ao fluxo.
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
                  {triggerNodes.map((nodeType) => (
                    <NodeCard
                      key={nodeType.type}
                      node={nodeType}
                      onClick={() => handleNodeSelect(nodeType)}
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
                {/* Ações core sem sub-grupo */}
                <div className="grid grid-cols-4 gap-2 px-4 pb-2">
                  {executionNodes
                    .filter((n) => !n.group)
                    .map((nodeType) => (
                      <NodeCard
                        key={nodeType.type}
                        node={nodeType}
                        onClick={() => handleNodeSelect(nodeType)}
                      />
                    ))}
                </div>

                {/* Sub-grupo "Adicionar Lead no App" — Form, Agenda, Forge,
                    Linnker, N-Box, NASA Route. */}
                {executionNodes.some((n) => n.group === "send-to-app") && (
                  <Accordion
                    type="single"
                    collapsible
                    defaultValue="send-to-app"
                    className="border-t mt-2"
                  >
                    <AccordionItem value="send-to-app">
                      <AccordionTrigger className="px-4 pt-3 pb-3 text-xs uppercase tracking-wide text-muted-foreground hover:no-underline">
                        Apps
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-4 gap-2 px-4 pb-2">
                          {executionNodes
                            .filter((n) => n.group === "send-to-app")
                            .map((nodeType) => (
                              <NodeCard
                                key={nodeType.type}
                                node={nodeType}
                                onClick={() => handleNodeSelect(nodeType)}
                              />
                            ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  );
}
