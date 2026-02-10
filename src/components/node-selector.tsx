"use client";

import { NodeType } from "@/generated/prisma/enums";
import { createId } from "@paralleldrive/cuid2";
import { useReactFlow } from "@xyflow/react";

import {
  ArrowLeftRightIcon,
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

export type NodeTypeOption = {
  type: NodeType;
  category: "trigger" | "execution";
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }> | string;
};

const triggerNodes: NodeTypeOption[] = [
  {
    type: NodeType.MANUAL_TRIGGER,
    category: "trigger",
    label: "Gatilho Manual",
    description:
      "Executa o fluxo ao clicar em um botão. Bom para começar rapidamente",
    icon: MousePointerIcon,
  },
  {
    type: NodeType.NEW_LEAD,
    category: "trigger",
    label: "Novo Lead",
    description: "Executa o fluxo ao criar um novo lead",
    icon: UserPlusIcon,
  },
];

const executionNodes: NodeTypeOption[] = [
  // {
  //   type: NodeType.HTTP_REQUEST,
  //   category: "execution",
  //   label: "HTTP Request",
  //   description: "Faz uma requisição HTTP",
  //   icon: GlobeIcon,
  // },
  {
    type: NodeType.MOVE_LEAD,
    category: "execution",
    label: "Mover Lead",
    description: "Mova o lead para outra etapa",
    icon: ArrowLeftRightIcon,
  },
  {
    type: NodeType.SEND_MESSAGE,
    category: "execution",
    label: "Enviar Mensagem",
    description: "Envie uma mensagem para o lead",
    icon: SendIcon,
  },
  {
    type: NodeType.WAIT,
    category: "execution",
    label: "Esperar",
    description: "Espera um tempo antes de continuar",
    icon: TimerIcon,
  },
  {
    type: NodeType.WIN_LOSS,
    category: "execution",
    label: "Ganho/Perdido",
    description: "Define se o lead foi ganho ou perdido",
    icon: Trophy,
  },
  {
    type: NodeType.TAG,
    category: "execution",
    label: "Tag",
    description: "Adiciona/remove uma tag",
    icon: TagIcon,
  },
];

interface NodeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId?: string;
  children: React.ReactNode;
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
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Automações</SheetTitle>
          <SheetDescription>
            Selecione o tipo de automação que deseja adicionar ao fluxo.
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
              <div>
                {triggerNodes.map((nodeType) => {
                  const Icon = nodeType.icon;

                  return (
                    <div
                      key={nodeType.type}
                      className="w-full justify-start h-auto py-5 px-4 rounded-none cursor-pointer border-l-2 border-transparent hover:border-l-primary"
                      onClick={() => handleNodeSelect(nodeType)}
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
              </div>
            </AccordionContent>
          </AccordionItem>
          {/* <Separator /> */}
          <AccordionItem value="execution">
            <AccordionTrigger className="px-4 pt-5 hover:no-underline">
              Ações
            </AccordionTrigger>
            <AccordionContent>
              <div>
                {executionNodes.map((nodeType) => {
                  const Icon = nodeType.icon;

                  return (
                    <div
                      key={nodeType.type}
                      className="w-full justify-start h-auto py-5 px-4 rounded-none cursor-pointer border-l-2 border-transparent hover:border-l-primary"
                      onClick={() => handleNodeSelect(nodeType)}
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
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SheetContent>
    </Sheet>
  );
}
