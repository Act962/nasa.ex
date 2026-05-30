import { NodeType } from "@/generated/prisma/enums";
import {
  ArrowLeftRightIcon,
  BotIcon,
  BrainIcon,
  CalendarIcon,
  CircleGaugeIcon,
  ClipboardListIcon,
  ClipboardPenIcon,
  CodeIcon,
  CreditCardIcon,
  EyeIcon,
  FileSignatureIcon,
  FileTextIcon,
  FolderOpenIcon,
  FunnelIcon,
  GitBranchIcon,
  GraduationCapIcon,
  HourglassIcon,
  GlobeIcon,
  ImageIcon,
  Link2Icon,
  MailIcon,
  MessageSquareIcon,
  MicIcon,
  MousePointerIcon,
  MoveHorizontalIcon,
  RepeatIcon,
  RouteIcon,
  SendIcon,
  ShuffleIcon,
  SparklesIcon,
  TagIcon,
  TagsIcon,
  TimerIcon,
  Trophy,
  UserPlusIcon,
  UserRoundPlusIcon,
  WebhookIcon,
} from "lucide-react";

export type NodeTypeOption = {
  type: NodeType;
  category: "trigger" | "execution" | "agent-mode";
  /** Sub-grupo opcional dentro da categoria — usado pelo NodeSelector
   *  pra renderizar accordion aninhado (ex: "Adicionar Lead no App"). */
  group?: "send-to-app" | "logic" | "ai" | "nasa-apps" | "data";
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }> | string;
  /** Marca exclusivos do Modo Agente IA — aparecem só quando workflow.agentMode = true. */
  agentModeOnly?: boolean;
  /**
   * Default data pra pré-popular `node.data` quando criado a partir desta
   * entrada do palette. Útil pra atalhos como "Menu de Botões" (que
   * cria um SEND_MESSAGE já com payload.type=BUTTONS).
   */
  defaultData?: Record<string, unknown>;
};

/**
 * Saídas semânticas por NodeType. Usado pelo AgentNode pra renderizar
 * handles visuais separados (IF_CONDITION → 2 saídas "true"/"false",
 * LOOP_OVER → "loop"/"done", AI_DECISION → branches dinâmicas, etc.).
 *
 * Nodes sem entrada aqui usam só "main" (saída única padrão).
 *
 * Pra outputs dinâmicos (AI_DECISION com N branches, SWITCH_CASE com N
 * cases), receba `data` do nó e retorne os outputs reais.
 */
export function getNodeOutputs(
  nodeType: string,
  data?: Record<string, unknown>,
): string[] {
  switch (nodeType) {
    case "IF_CONDITION":
      return ["true", "false"];
    case "LOOP_OVER":
      return ["loop", "done"];
    case "CHECK_PAYMENT":
      return ["paid", "pending", "failed"];
    case "AI_DECISION": {
      const branches = Array.isArray(data?.branches)
        ? (data!.branches as Array<{ id?: string }>)
        : [];
      const ids = branches
        .map((b) => String(b.id ?? "").trim())
        .filter(Boolean);
      return ids.length > 0 ? ids : ["main"];
    }
    case "SWITCH_CASE": {
      const cases = Array.isArray(data?.cases)
        ? (data!.cases as Array<{ output?: string }>)
        : [];
      const outs = cases
        .map((c) => String(c.output ?? "").trim())
        .filter(Boolean);
      return outs.length > 0 ? [...outs, "default"] : ["main"];
    }
    default:
      return ["main"];
  }
}

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
  // ─── Triggers do Modo Agente IA ──────────────────────────────────────
  // Habilitam multi-trigger por workflow. Liberados quando workflow.agentMode = true.
  {
    type: NodeType.PAYMENT_RECEIVED,
    category: "trigger",
    label: "Pagamento Recebido",
    description:
      "Dispara quando pagamento Stripe/Asaas/PIX é confirmado para o lead",
    icon: CreditCardIcon,
    agentModeOnly: true,
  },
  {
    type: NodeType.MESSAGE_INCOMING,
    category: "trigger",
    label: "Mensagem Recebida",
    description:
      "Dispara quando o lead envia uma nova mensagem no WhatsApp",
    icon: MailIcon,
    agentModeOnly: true,
  },
  {
    type: NodeType.WEBHOOK_EXTERNAL,
    category: "trigger",
    label: "Webhook Externo",
    description:
      "Dispara quando um sistema externo (Zapier, Make, custom) envia POST",
    icon: WebhookIcon,
    agentModeOnly: true,
  },
];

// ─── Nodes do Modo Agente IA ─────────────────────────────────────────────
// Reusados em editor de tracking E workspace quando workflow.agentMode = true.
// Organizado em 3 grupos para renderização em accordions separados.
export const agentModeNodes: NodeTypeOption[] = [
  // ▽ Lógica — branches, loops, esperas
  {
    type: NodeType.IF_CONDITION,
    category: "agent-mode",
    group: "logic",
    label: "Condicional (Se / Senão)",
    description:
      "Divide o fluxo em 2 ramos baseado em uma condição (ex: lead.tag == 'VIP')",
    icon: GitBranchIcon,
    agentModeOnly: true,
  },
  {
    type: NodeType.SWITCH_CASE,
    category: "agent-mode",
    group: "logic",
    label: "Múltiplos Casos",
    description:
      "Divide o fluxo em N ramos baseado no valor de um campo (Switch)",
    icon: ShuffleIcon,
    agentModeOnly: true,
  },
  {
    type: NodeType.LOOP_OVER,
    category: "agent-mode",
    group: "logic",
    label: "Repetir Para Cada",
    description:
      "Itera sobre um array (ex: lista de tags do lead, follow-ups) com limite máximo",
    icon: RepeatIcon,
    agentModeOnly: true,
  },
  {
    type: NodeType.MERGE,
    category: "agent-mode",
    group: "logic",
    label: "Juntar Ramos",
    description: "Consolida múltiplos ramos paralelos antes de continuar",
    icon: RouteIcon,
    agentModeOnly: true,
  },
  {
    type: NodeType.WAIT_FOR_EVENT,
    category: "agent-mode",
    group: "logic",
    label: "Esperar Evento",
    description:
      "Pausa o fluxo até um evento (presets: sem 1ª resposta do lead, conversa ociosa, mensagem do lead — ou evento Inngest custom)",
    icon: HourglassIcon,
    agentModeOnly: true,
  },

  // ▽ IA — decisão e geração
  {
    type: NodeType.AI_DECISION,
    category: "agent-mode",
    group: "ai",
    label: "Decisão da IA",
    description:
      "Astro escolhe o próximo ramo com base no contexto e nas opções disponíveis",
    icon: BrainIcon,
    agentModeOnly: true,
  },
  {
    type: NodeType.AI_GENERATE_TEXT,
    category: "agent-mode",
    group: "ai",
    label: "Gerar Texto com IA",
    description:
      "Gera uma mensagem contextualizada (chama nome, varia tom) para o lead",
    icon: SparklesIcon,
    agentModeOnly: true,
  },
  {
    type: NodeType.AI_VISION,
    category: "agent-mode",
    group: "ai",
    label: "Analisar Imagem",
    description:
      "IA analisa imagem enviada pelo lead (comprovante, foto, documento)",
    icon: EyeIcon,
    agentModeOnly: true,
  },
  {
    type: NodeType.READ_PDF,
    category: "agent-mode",
    group: "ai",
    label: "Ler PDF",
    description: "IA extrai texto de PDF e interpreta o conteúdo solicitado",
    icon: FileTextIcon,
    agentModeOnly: true,
  },

  // ▽ Apps NASA — pagamento, mídia e voz
  {
    type: NodeType.CHECK_PAYMENT,
    category: "agent-mode",
    group: "nasa-apps",
    label: "Conferir Pagamento",
    description:
      "Consulta status de pagamento Stripe ou Asaas do lead (pago / pendente / falhou)",
    icon: CreditCardIcon,
    agentModeOnly: true,
  },
  {
    type: NodeType.SEND_VOICE,
    category: "agent-mode",
    group: "nasa-apps",
    label: "Enviar Voz (Astro)",
    description:
      "Gera áudio com voz natural do Astro (TTS) e envia ao lead via WhatsApp",
    icon: MicIcon,
    agentModeOnly: true,
  },
  {
    type: NodeType.SEND_MEDIA,
    category: "agent-mode",
    group: "nasa-apps",
    label: "Enviar Mídia",
    description: "Envia imagem, vídeo, áudio ou documento ao lead via WhatsApp",
    icon: ImageIcon,
    agentModeOnly: true,
  },
  {
    type: NodeType.WEB_SEARCH,
    category: "agent-mode",
    group: "nasa-apps",
    label: "Pesquisar na Web",
    description:
      "Busca informações atualizadas via Gemini ou OpenAI (preço, dados públicos, validações em tempo real)",
    icon: GlobeIcon,
    agentModeOnly: true,
  },

  // ▽ Dados — variáveis e sub-workflows
  {
    type: NodeType.SET_VARIABLE,
    category: "agent-mode",
    group: "data",
    label: "Definir Variável",
    description:
      "Cria/atualiza uma variável no contexto pra usar em nós seguintes ({{nome}})",
    icon: CodeIcon,
    agentModeOnly: true,
  },
  {
    type: NodeType.CALL_WORKFLOW,
    category: "agent-mode",
    group: "data",
    label: "Chamar Sub-Workflow",
    description:
      "Executa outro workflow como subrotina (reutiliza blocos como qualificação ou pós-venda)",
    icon: BotIcon,
    agentModeOnly: true,
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
    // Atalho: cria SEND_MESSAGE já pré-configurado pra menu de botões.
    // Reusa o mesmo NodeType (sem migration), só seta defaultData pra o
    // dialog abrir direto na variante BUTTONS. Disponível também em
    // legacy (não-agent-mode) — espelha a aba "Presets de botões" do
    // Chatbot IA mas no contexto de automação.
    type: NodeType.SEND_MESSAGE,
    category: "execution",
    label: "Menu de Botões",
    description:
      "Envia menu interativo com até 9 botões (reusa presets do Chatbot IA ou inline)",
    icon: MousePointerIcon,
    defaultData: {
      action: { payload: { type: "BUTTONS", mode: "preset" } },
    },
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
