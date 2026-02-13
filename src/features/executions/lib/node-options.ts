import { NodeType } from "@/generated/prisma/enums";
import {
  ArrowLeftRightIcon,
  CircleGaugeIcon,
  MousePointerIcon,
  MoveHorizontalIcon,
  SendIcon,
  TagIcon,
  TimerIcon,
  Trophy,
  UserPlusIcon,
  UserRoundPlusIcon,
} from "lucide-react";

export type NodeTypeOption = {
  type: NodeType;
  category: "trigger" | "execution";
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }> | string;
};

export const triggerNodes: NodeTypeOption[] = [
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
  {
    type: NodeType.MOVE_LEAD_STATUS,
    category: "trigger",
    label: "Mover Lead para Status",
    description: "Executa o fluxo ao mover um lead para um status",
    icon: MoveHorizontalIcon,
  },
];

export const executionNodes: NodeTypeOption[] = [
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
  {
    type: NodeType.TEMPERATURE,
    category: "execution",
    label: "Temperatura",
    description: "Altera a temperatura do lead",
    icon: CircleGaugeIcon,
  },
  {
    type: NodeType.RESPONSIBLE,
    category: "execution",
    label: "Responsável",
    description: "Atribui um responsável ao lead",
    icon: UserRoundPlusIcon,
  },
];
