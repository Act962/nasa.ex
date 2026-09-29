/**
 * Voz do ASTRO para alertas e notificações (spec 0029, RF-1).
 *
 * Pura e sem I/O: roda no servidor (lista do sino, Pusher) e no cliente
 * (widget, orb). A fala vem de template, não de LLM — alerta não gasta Stars e
 * nunca diz algo que o dado não diz (D-1).
 */

export type AstroVoicePriority = "urgent" | "important" | "info";

export type AstroVoiceAction =
  | { kind: "prompt"; label: string; prompt: string }
  | { kind: "link"; label: string; href: string };

export interface AstroVoice {
  /** Título curto do balão do orb ("Boleto vencendo hoje"). */
  headline: string;
  speech: string;
  priority: AstroVoicePriority;
  actions: AstroVoiceAction[];
}

export interface AstroVoiceInput {
  /** `eventType` do motor de alertas ou `type` do notification-service. */
  kind: string | null | undefined;
  title: string;
  body: string;
  actionUrl?: string | null;
  severity?: string | null;
  /** `eventPayload` do motor ou `metadata` da notificação direta. */
  payload?: unknown;
}

type VoiceBuilder = (input: AstroVoiceInput, data: Record<string, unknown>) => AstroVoice;

function readString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(data: Record<string, unknown>, key: string): number | undefined {
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function formatMoney(value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function openLink(input: AstroVoiceInput, label: string): AstroVoiceAction[] {
  return input.actionUrl ? [{ kind: "link", label, href: input.actionUrl }] : [];
}

const BUILDERS: Record<string, VoiceBuilder> = {
  // ── Atendimento ─────────────────────────────────────────────────────────
  "chat.message_received": (input, data) => {
    const leadName = readString(data, "leadName") ?? readString(data, "contactName");
    return {
      headline: leadName ? `${leadName} mandou mensagem` : "Nova mensagem de lead",
      speech: leadName
        ? `Oi, aqui é o Astro. ${leadName} acabou de te chamar no chat.`
        : "Oi, aqui é o Astro. Um lead acabou de te chamar no chat.",
      priority: "important",
      actions: [
        ...openLink(input, "Abrir conversa"),
        {
          kind: "prompt",
          label: "Sugerir resposta",
          prompt: leadName
            ? `Leia a conversa com ${leadName} e me sugira uma resposta.`
            : "Leia a última conversa que chegou e me sugira uma resposta.",
        },
      ],
    };
  },

  "chat.lead_calling": (input, data) => {
    const leadName = readString(data, "leadName") ?? "Um lead";
    const preview = readString(data, "messagePreview");
    const isQuestion = data.isQuestion === true;
    return {
      headline: isQuestion
        ? `${leadName} está fazendo uma pergunta`
        : `Nova conversa com ${leadName}`,
      speech: preview
        ? `${leadName} escreveu: "${preview}"`
        : `Oi, aqui é o Astro. ${leadName} acabou de te chamar no chat.`,
      priority: isQuestion ? "urgent" : "important",
      actions: [
        ...openLink(input, "Abrir conversa"),
        {
          kind: "prompt",
          label: "Sugerir resposta",
          prompt: `Leia a conversa com ${leadName} e me sugira uma resposta.`,
        },
      ],
    };
  },

  "chat.lead_waiting": (input, data) => {
    const leadName = readString(data, "leadName") ?? "um lead";
    const minutes = readNumber(data, "waitingMinutes") ?? 5;
    return {
      headline: `${leadName} esperando resposta`,
      speech: `Ei, ${leadName} está esperando resposta há ${minutes} minutos. Quer que eu prepare uma resposta?`,
      priority: "urgent",
      actions: [
        ...openLink(input, "Responder agora"),
        {
          kind: "prompt",
          label: "Preparar resposta",
          prompt: `Leia a conversa com ${leadName} e prepare uma resposta para eu revisar.`,
        },
      ],
    };
  },

  "lead.stale": (input) => ({
    headline: "Lead parado no funil",
    speech: `Aqui é o Astro. ${input.body || "Tem lead parado há dias no funil."} Bora retomar?`,
    priority: "important",
    actions: [
      ...openLink(input, "Ver lead"),
      {
        kind: "prompt",
        label: "Sugerir follow-up",
        prompt: "Quais leads estão parados há mais tempo? Sugira um follow-up para cada um.",
      },
    ],
  }),

  // ── Financeiro ──────────────────────────────────────────────────────────
  "payment.expense_due_today": (input, data) => {
    const entryTitle = readString(data, "entryTitle") ?? "uma despesa";
    const amount = formatMoney(readNumber(data, "amount"));
    return {
      headline: "Boleto vencendo hoje",
      speech: `Oi, aqui é o Astro. O pagamento ${entryTitle}${amount ? ` de ${amount}` : ""} vence hoje e ainda não foi pago. Quer que eu te mande ele aqui?`,
      priority: "urgent",
      actions: [
        {
          kind: "prompt",
          label: "Me manda o boleto",
          prompt: `Me mostre o lançamento ${entryTitle} que vence hoje, com o boleto ou a linha digitável.`,
        },
        ...openLink(input, "Abrir no financeiro"),
      ],
    };
  },

  // ── Jurídico / comercial ────────────────────────────────────────────────
  "forge.contract_expiring": (input, data) => {
    const contractTitle = readString(data, "contractTitle") ?? "um contrato";
    const daysLeft = readNumber(data, "daysLeft");
    const when =
      daysLeft === undefined
        ? "está vencendo"
        : daysLeft <= 0
          ? "vence hoje"
          : `vence em ${daysLeft} dia${daysLeft === 1 ? "" : "s"}`;
    return {
      headline: daysLeft !== undefined && daysLeft <= 0 ? "Contrato vence hoje" : "Contrato vencendo",
      speech: `Aqui é o Astro. ${capitalize(contractTitle)} ${when}. Quer que eu prepare a renovação?`,
      priority: daysLeft !== undefined && daysLeft <= 1 ? "urgent" : "important",
      actions: [
        ...openLink(input, "Abrir contrato"),
        {
          kind: "prompt",
          label: "Preparar renovação",
          prompt: `Prepare uma proposta de renovação para ${contractTitle}.`,
        },
      ],
    };
  },

  // ── Equipe ──────────────────────────────────────────────────────────────
  "action.due_soon": (input) => ({
    headline: "Tarefa vence hoje",
    speech: `Aqui é o Astro. ${input.title} vence hoje e ainda não foi concluída.`,
    priority: "important",
    actions: openLink(input, "Abrir tarefa"),
  }),

  "action.overdue": (input) => ({
    headline: "Tarefa atrasada",
    speech: `Atenção: ${input.title} já passou do prazo.`,
    priority: "urgent",
    actions: openLink(input, "Abrir tarefa"),
  }),

  "agenda.starting_soon": (input) => ({
    headline: "Compromisso começando",
    speech: `Aqui é o Astro. ${input.title} começa daqui a pouco.`,
    priority: "important",
    actions: openLink(input, "Ver agenda"),
  }),

  // ── Conta ───────────────────────────────────────────────────────────────
  STARS_ALERT: () => ({
    headline: "Stars acabando",
    speech: "Ei, os Stars estão acabando. Melhor recarregar antes que eu pare no meio de algo importante.",
    priority: "important",
    actions: [{ kind: "link", label: "Recarregar", href: "/settings/billing" }],
  }),

  // Spec 0039: ação "Lembrar a equipe" de um Gatilho Automático.
  "workflow.reminder": (input, data) => {
    const message = readString(data, "message") ?? input.body;
    return {
      headline: input.title,
      speech: `Lembrete: ${message}`,
      priority: "important",
      actions: openLink(input, "Abrir lead"),
    };
  },

  // Spec 0037: crédito do provedor acabou / consumo alto no dia.
  "ai.quota_exhausted": () => ({
    headline: "Crédito da IA acabou",
    speech: "Atenção: a IA ficou sem crédito no provedor. Eu, a IA do WhatsApp e os Workflows paramos de responder até recarregar.",
    priority: "urgent",
    actions: [],
  }),

  "ai.token_usage_high": (_input, data) => {
    const tokens = readNumber(data, "tokens");
    return {
      headline: "Consumo alto de tokens",
      speech: `Ei, a IA já usou ${tokens ? tokens.toLocaleString("pt-BR") : "muitos"} tokens hoje. Vale ficar de olho no crédito.`,
      priority: "important",
      actions: [{ kind: "link", label: "Ver consumo", href: "/astro?aba=visao-geral" }],
    };
  },

  AI_TOKEN_ALERT: () => ({
    headline: "Tokens de IA acabando",
    speech: "Ei, os tokens de IA estão acabando. Melhor recarregar.",
    priority: "important",
    actions: [{ kind: "link", label: "Ver consumo", href: "/astro?aba=visao-geral" }],
  }),

  // ── ASTRO COMMANDER ─────────────────────────────────────────────────────
  ASTRO_APPROVAL_PENDING: (input) => ({
    headline: "Aprovação pendente",
    speech: `Preparei tudo, mas preciso do seu ok: ${input.title}.`,
    priority: "urgent",
    actions: [{ kind: "link", label: "Revisar", href: "/astro?aba=aprovacoes" }],
  }),

  ASTRO_COMMAND_FAILED: (input) => ({
    headline: "Comando falhou",
    speech: `Não consegui terminar um comando: ${input.title}. Dá uma olhada?`,
    priority: "important",
    actions: openLink(input, "Ver execução"),
  }),

  // ── Pagamentos (notificações diretas já existentes) ─────────────────────
  PAYMENT_OVERDUE_ALERT: (input) => ({
    headline: "Conta vencida",
    speech: `Aqui é o Astro. ${input.body || "Uma conta venceu e segue pendente."}`,
    priority: "urgent",
    actions: openLink(input, "Abrir no financeiro"),
  }),

  PAYMENT_RECEIVED: (input) => ({
    headline: "Pagamento recebido",
    speech: `Boa notícia: ${input.body || "um pagamento acabou de cair."}`,
    priority: "info",
    actions: openLink(input, "Ver recebimento"),
  }),

  PAYMENT_APPROVAL_PENDING: (input) => ({
    headline: "Pagamento para aprovar",
    speech: `Tem um pagamento esperando sua aprovação: ${input.title}.`,
    priority: "urgent",
    actions: openLink(input, "Aprovar"),
  }),

  PAYMENT_RESERVE_AT_RISK: (input) => ({
    headline: "Reserva de caixa em risco",
    speech: `Atenção: ${input.body || "o mês caminha para fechar abaixo da reserva."} Quer que eu te mostre o que dá pra segurar?`,
    priority: "urgent",
    actions: [
      {
        kind: "prompt",
        label: "O que dá pra segurar?",
        prompt: "Quais despesas deste mês eu posso adiar para não furar a reserva de caixa?",
      },
      ...openLink(input, "Ver financeiro"),
    ],
  }),

  PAYMENT_EXPENSE_CRITICAL: (input) => ({
    headline: "Despesa derruba a reserva",
    speech: `Aqui é o Astro. ${input.body || "Uma despesa lançada joga o caixa abaixo da reserva."}`,
    priority: "urgent",
    actions: openLink(input, "Ver lançamento"),
  }),

  PAYMENT_GOAL_REACHED: (input) => ({
    headline: "Meta de vendas batida",
    speech: `Boa! ${input.body || "A receita do mês atingiu a meta."}`,
    priority: "info",
    actions: openLink(input, "Ver financeiro"),
  }),

  NEW_LEAD: (input) => ({
    headline: "Novo lead",
    speech: `Aqui é o Astro. Chegou lead novo: ${input.title}.`,
    priority: "important",
    actions: openLink(input, "Ver lead"),
  }),

  TRAFEGO_LEAD_CAPTURED: (input) => ({
    headline: "Novo lead do trafeGO",
    speech: `Aqui é o Astro. Chegou lead novo pelo trafeGO: ${input.title}.`,
    priority: "important",
    actions: openLink(input, "Ver lead"),
  }),

  APPOINTMENT_REMINDER: (input) => ({
    headline: "Lembrete de agenda",
    speech: `Aqui é o Astro. Lembrete: ${input.title}.`,
    priority: "important",
    actions: openLink(input, "Ver agenda"),
  }),
};

function severityToPriority(severity: string | null | undefined): AstroVoicePriority {
  if (severity === "critical") return "urgent";
  if (severity === "warning") return "important";
  return "info";
}

/**
 * Fala do ASTRO para um alerta. Tipo sem template cai no genérico — melhor uma
 * fala simples do que um alerta que o ASTRO não assume.
 */
export function buildAstroVoice(input: AstroVoiceInput): AstroVoice {
  const data =
    input.payload && typeof input.payload === "object"
      ? (input.payload as Record<string, unknown>)
      : {};
  const builder = input.kind ? BUILDERS[input.kind] : undefined;
  if (builder) return builder(input, data);

  const detail = input.body && input.body !== input.title ? ` ${input.body}` : "";
  return {
    headline: input.title,
    speech: `Aqui é o Astro. ${input.title}.${detail}`.replace(/\.\./g, "."),
    priority: severityToPriority(input.severity),
    actions: openLink(input, "Abrir"),
  };
}

/** Prioridades que justificam o orb pulsar e, com voz ligada, falar. */
export function isAudiblePriority(priority: AstroVoicePriority): boolean {
  return priority === "urgent" || priority === "important";
}

/** Com a voz ligada, só alerta audível é falado; desligada, fica no balão (F9-05). */
export function shouldSpeakAlert(outputMode: string, priority: AstroVoicePriority): boolean {
  return outputMode === "audio" && isAudiblePriority(priority);
}
