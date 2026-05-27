import { NodeType } from "@/generated/prisma/enums";
import {
  ArrowLeftRightIcon,
  BotIcon,
  CalendarIcon,
  CircleGaugeIcon,
  ClipboardListIcon,
  ClipboardPenIcon,
  FileSignatureIcon,
  FileTextIcon,
  FolderOpenIcon,
  FunnelIcon,
  GraduationCapIcon,
  Link2Icon,
  MessageSquareIcon,
  MousePointerIcon,
  MoveHorizontalIcon,
  SendIcon,
  TagIcon,
  TagsIcon,
  TimerIcon,
  Trophy,
  UserPlusIcon,
  UserRoundPlusIcon,
} from "lucide-react";

export type NodeTypeOption = {
  type: NodeType;
  category: "trigger" | "execution";
  /** Sub-grupo opcional dentro da categoria — usado pelo NodeSelector
   *  pra renderizar accordion aninhado (ex: "Adicionar Lead no App"). */
  group?: "send-to-app";
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
  {
    type: NodeType.LEAD_TAGGED,
    category: "trigger",
    label: "Lead com Tag",
    description: "Executa o fluxo ao adicionar uma tag ao lead",
    icon: TagsIcon,
  },
  {
    type: NodeType.AI_FINISHED,
    category: "trigger",
    label: "IA Finalizou o Atendimento",
    description: "Executa o fluxo ao finalizar um atendimento com IA",
    icon: BotIcon,
  },
  {
    type: NodeType.FIRST_CHAT_INTERACTION,
    category: "trigger",
    label: "Primeira Interação no Chat",
    description:
      "Executa o fluxo quando o usuário envia a primeira mensagem ao lead",
    icon: MessageSquareIcon,
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
  {
    type: NodeType.FILTER_LEAD,
    category: "execution",
    label: "Filtrar Leads",
    description: "Filtra leads com base em critérios",
    icon: FunnelIcon,
  },

  // ─── Adicionar Lead no App ─────────────────────────────────────────────
  // 7 actions agrupadas no NodeSelector como sub-categoria. Cada uma cria
  // um recurso do app correspondente vinculado ao lead e envia link via
  // WhatsApp (com fallback In-Chat quando instância banida).
  {
    type: NodeType.SEND_FORM,
    category: "execution",
    group: "send-to-app",
    label: "Enviar Formulário",
    description: "Cria resposta vinculada ao lead e envia link do formulário",
    icon: ClipboardListIcon,
  },
  {
    type: NodeType.OPEN_FORM,
    category: "execution",
    group: "send-to-app",
    label: "Abrir Formulário",
    description:
      "Marca form pendente — operador preenche no app, sem enviar link",
    icon: ClipboardPenIcon,
  },
  {
    type: NodeType.SEND_AGENDA,
    category: "execution",
    group: "send-to-app",
    label: "Enviar Link de Agenda",
    description: "Envia link público pro lead agendar um horário",
    icon: CalendarIcon,
  },
  {
    type: NodeType.SEND_PROPOSAL,
    category: "execution",
    group: "send-to-app",
    label: "Enviar Proposta",
    description: "Cria proposta com produtos + responsável e envia link",
    icon: FileSignatureIcon,
  },
  {
    type: NodeType.SEND_CONTRACT,
    category: "execution",
    group: "send-to-app",
    label: "Enviar Contrato",
    description: "Clona template de contrato + envia link de assinatura",
    icon: FileTextIcon,
  },
  {
    type: NodeType.SEND_LINNKER,
    category: "execution",
    group: "send-to-app",
    label: "Enviar Linnker",
    description: "Envia link público de página Linnker pro lead",
    icon: Link2Icon,
  },
  {
    type: NodeType.SEND_NBOX,
    category: "execution",
    group: "send-to-app",
    label: "Enviar Arquivo N-Box",
    description: "Marca arquivo como público e envia link de download",
    icon: FolderOpenIcon,
  },
  {
    type: NodeType.SEND_NASA_ROUTE,
    category: "execution",
    group: "send-to-app",
    label: "Enviar Curso NASA Route",
    description: "Envia link do curso (matrícula direta se free, checkout se pago)",
    icon: GraduationCapIcon,
  },
];
