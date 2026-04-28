import { NodeType } from "@/generated/prisma/enums";
import {
  ArchiveIcon,
  ArrowLeftRightIcon,
  CheckCircle2Icon,
  FunnelIcon,
  ListChecksIcon,
  MailIcon,
  MousePointerIcon,
  MoveHorizontalIcon,
  PlusCircleIcon,
  PlusSquareIcon,
  SendIcon,
  TagIcon,
  TagsIcon,
  TimerIcon,
  UserPlusIcon,
  UserRoundPlusIcon,
} from "lucide-react";

export type WsNodeTypeOption = {
  type: NodeType;
  category: "trigger" | "execution";
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }> | string;
};

export const wsTriggerNodes: WsNodeTypeOption[] = [
  {
    type: NodeType.WS_MANUAL_TRIGGER,
    category: "trigger",
    label: "Gatilho Manual",
    description: "Execute o fluxo manualmente",
    icon: MousePointerIcon,
  },
  {
    type: NodeType.WS_ACTION_CREATED,
    category: "trigger",
    label: "Ação criada",
    description: "Executa ao criar uma ação",
    icon: PlusCircleIcon,
  },
  {
    type: NodeType.WS_ACTION_MOVED_COLUMN,
    category: "trigger",
    label: "Ação movida",
    description: "Executa ao mover ação para coluna",
    icon: MoveHorizontalIcon,
  },
  {
    type: NodeType.WS_ACTION_TAGGED,
    category: "trigger",
    label: "Ação etiquetada",
    description: "Executa ao adicionar etiqueta",
    icon: TagsIcon,
  },
  {
    type: NodeType.WS_ACTION_COMPLETED,
    category: "trigger",
    label: "Ação concluída",
    description: "Executa ao concluir ação",
    icon: CheckCircle2Icon,
  },
  // {
  //   type: NodeType.WS_ACTION_PARTICIPANT_ADDED,
  //   category: "trigger",
  //   label: "Participante adicionado",
  //   description: "Executa ao adicionar participante",
  //   icon: UserPlusIcon,
  // },
];

export const wsExecutionNodes: WsNodeTypeOption[] = [
  {
    type: NodeType.WS_CREATE_ACTION,
    category: "execution",
    label: "Criar ação",
    description: "Cria uma nova ação",
    icon: PlusSquareIcon,
  },
  {
    type: NodeType.WS_MOVE_ACTION,
    category: "execution",
    label: "Mover ação",
    description: "Move ação para outra coluna",
    icon: ArrowLeftRightIcon,
  },
  {
    type: NodeType.WS_ADD_TAG_ACTION,
    category: "execution",
    label: "Adicionar etiqueta",
    description: "Adiciona etiqueta à ação",
    icon: TagIcon,
  },
  {
    type: NodeType.WS_ADD_PARTICIPANT,
    category: "execution",
    label: "Adicionar participante",
    description: "Adiciona participante à ação",
    icon: UserPlusIcon,
  },
  // {
  //   type: NodeType.WS_SET_RESPONSIBLE,
  //   category: "execution",
  //   label: "Definir responsável",
  //   description: "Define responsável da ação",
  //   icon: UserRoundPlusIcon,
  // },
  {
    type: NodeType.WS_CREATE_SUB_ACTION,
    category: "execution",
    label: "Criar sub-ação",
    description: "Cria sub-ação",
    icon: ListChecksIcon,
  },
  {
    type: NodeType.WS_SEND_MESSAGE_PARTICIPANTS,
    category: "execution",
    label: "Mensagem (WhatsApp)",
    description: "Envia WhatsApp aos participantes",
    icon: SendIcon,
  },
  {
    type: NodeType.WS_SEND_EMAIL_PARTICIPANTS,
    category: "execution",
    label: "Email/Notificação",
    description: "Envia notificação aos participantes",
    icon: MailIcon,
  },
  {
    type: NodeType.WS_ARCHIVE_ACTION,
    category: "execution",
    label: "Arquivar ação",
    description: "Arquiva a ação",
    icon: ArchiveIcon,
  },
  {
    type: NodeType.WS_WAIT,
    category: "execution",
    label: "Esperar",
    description: "Aguarda antes de continuar",
    icon: TimerIcon,
  },
  {
    type: NodeType.WS_FILTER,
    category: "execution",
    label: "Filtrar",
    description: "Condição booleana sobre a ação",
    icon: FunnelIcon,
  },
];
