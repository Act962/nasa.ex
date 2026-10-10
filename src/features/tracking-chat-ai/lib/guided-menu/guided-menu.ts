import "server-only";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type { ToolSet } from "ai";
import prisma from "@/lib/prisma";
import { TrackingProviderBotChannel } from "@/features/astro-bot/lib/tracking-provider-channel";
import type { AgentContext } from "../context";
import { persistOutboundMessage } from "../persist";
import { buildLeadAgendaScope } from "../../server/tools";
import { makeLeadAgendaTools } from "../../server/tools/agenda";
import { makeTransferToHumanTool } from "../../server/tools/transfer-to-human";
import { clientMenuId, isClientMenuId, parseClientMenuId, type ClientMenuStep } from "./menu-ids";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Atendimento ao cliente por botões e listas (spec 0089). Os passos de escolha rodam aqui, em
 * código, sem modelo: marcar, ver, remarcar e cancelar usam as mesmas ferramentas da assistente,
 * presas ao lead da conversa. O que não é clique nem saudação volta para a assistente.
 */

const AGENDA_TIME_ZONE = "America/Sao_Paulo";
const MAX_LIST_ROWS = 10;
const SLOTS_PER_PAGE = 9;
const DAYS_TO_OFFER = 9;
const DAYS_TO_SCAN = 21;
const MAX_BUTTON_TITLE = 20;
const MAX_ROW_TITLE = 24;
const MAX_ROW_DESCRIPTION = 72;
const MAX_CLICKS_PER_HOUR = 120;
const HOUR_MS = 60 * 60_000;
const GREETING_PATTERN = /^(oi+|ola|opa|bom dia|boa tarde|boa noite|menu|opcoes|ajuda|inicio|comecar|voltar|e ai|eai|hello|hi)\b[\s!.?,]*$/;
const NUMBERED_ANSWER = /^\d{1,2}$/;
const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

interface MenuOption {
  id: string;
  title: string;
  description?: string;
}

type ToolOutput = Record<string, unknown>;

async function runAgendaTool(tools: ToolSet, toolName: string, input: Record<string, unknown>): Promise<ToolOutput> {
  const definition = tools[toolName] as { execute?: (input: unknown, options: { toolCallId: string; messages: [] }) => Promise<unknown> } | undefined;
  if (!definition?.execute) return { error: "Opção indisponível." };
  const output = await definition.execute(input, { toolCallId: `menu-${Date.now()}`, messages: [] });
  return (output ?? {}) as ToolOutput;
}

function shorten(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
}

/**
 * Nomes longos que começam igual ("Consulta oftalmológica — Unidade Centro" e "… — Unidade Jóckei")
 * ficam idênticos quando encurtados. Nesse caso o título vira a parte que os diferencia.
 */
function distinctTitles(titles: string[], limit: number): string[] {
  const shortened = titles.map((title) => shorten(title, limit));
  const result = [...shortened];
  for (const collidingTitle of new Set(shortened.filter((title, index) => shortened.indexOf(title) !== index))) {
    const positions = shortened.flatMap((title, index) => (title === collidingTitle ? [index] : []));
    const words = positions.map((position) => titles[position].split(/\s+/));
    let sharedWords = 0;
    while (words.every((titleWords) => titleWords.length > sharedWords + 1 && titleWords[sharedWords] === words[0][sharedWords])) {
      sharedWords += 1;
    }
    const distinct = words.map((titleWords) => shorten(titleWords.slice(sharedWords).join(" ").replace(/^[\s—–\-:·|]+/, ""), limit));
    if (new Set(distinct).size !== distinct.length || distinct.some((title) => title.length === 0)) continue;
    positions.forEach((position, index) => {
      result[position] = distinct[index];
    });
  }
  return result;
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function describeDay(date: string): { short: string; long: string } {
  const day = dayjs.tz(date, AGENDA_TIME_ZONE);
  const dayAndMonth = day.format("DD/MM");
  return { short: `${WEEKDAY_SHORT[day.day()]}, ${dayAndMonth}`, long: `${WEEKDAY_LONG[day.day()]}, ${dayAndMonth}` };
}

/** O que o menu precisa do canal. Separado para a verificação rodar sem mandar nada ao WhatsApp. */
export type GuidedMenuChannel = Pick<TrackingProviderBotChannel, "sendButtons" | "sendText">;

class GuidedMenu {
  private readonly channel: GuidedMenuChannel;
  private readonly tools: ToolSet;
  private readonly hasAgenda: boolean;

  constructor(
    private readonly ctx: AgentContext,
    channel?: GuidedMenuChannel,
  ) {
    this.channel = channel ?? new TrackingProviderBotChannel(ctx.trackingId);
    const scope = buildLeadAgendaScope(ctx);
    this.hasAgenda = scope !== null;
    this.tools = scope ? makeLeadAgendaTools(scope) : {};
  }

  private get assistantName(): string {
    return this.ctx.settings?.assistantName?.trim() || "Astro";
  }

  private async persist(body: string, externalMessageId: string | null, options: MenuOption[]): Promise<void> {
    const optionsLine = options.length > 0 ? `\n[opções: ${options.map((option) => option.title).join(" · ")}]` : "";
    await persistOutboundMessage({
      conversationId: this.ctx.conversation.id,
      leadId: this.ctx.lead.id,
      trackingId: this.ctx.trackingId,
      body: `${body}${optionsLine}`,
      senderName: this.assistantName,
      externalMessageId: externalMessageId ?? `guided-${this.ctx.lead.id}-${Date.now()}`,
      // As opções ficam na mensagem: é por elas que uma resposta "2" (número sem botão) acha o que foi escolhido.
      metadata: { guidedMenu: true, guidedOptions: options.map((option) => ({ id: option.id, title: option.title })) },
    });
  }

  private async sendChoice(body: string, options: MenuOption[], listButtonLabel = "Ver opções"): Promise<void> {
    const shown = options.slice(0, MAX_LIST_ROWS);
    const titleLimit = shown.length <= 3 ? MAX_BUTTON_TITLE : MAX_ROW_TITLE;
    const titles = distinctTitles(shown.map((option) => option.title), titleLimit);
    const sent = await this.channel.sendButtons(this.ctx.lead.phone!, {
      bodyText: body,
      listButtonLabel,
      isImmediate: true,
      buttons: shown.map((option, index) => ({
        id: option.id,
        text: titles[index],
        // Nome que não coube no título vai inteiro na descrição da linha.
        description:
          option.description || titles[index] !== option.title
            ? shorten(option.description ?? option.title, MAX_ROW_DESCRIPTION)
            : undefined,
      })),
    });
    await this.persist(body, sent.messageId, shown);
  }

  private async sendText(text: string): Promise<void> {
    const sent = await this.channel.sendText(this.ctx.lead.phone!, text, { isImmediate: true });
    await this.persist(text, sent.messageId, []);
  }

  private backToMenu(): MenuOption {
    return { id: clientMenuId({ step: "menu" }), title: "Menu" };
  }

  private humanOption(): MenuOption {
    return { id: clientMenuId({ step: "human" }), title: "Atendente" };
  }

  async showMenu(): Promise<void> {
    const body = `Olá! Aqui é ${this.assistantName}, assistente virtual da ${this.ctx.organization.name}. Escolha uma opção ou escreva sua dúvida.`;
    const options: MenuOption[] = this.hasAgenda
      ? [
          { id: clientMenuId({ step: "book" }), title: "Agendar" },
          { id: clientMenuId({ step: "mine" }), title: "Meus horários" },
          { id: clientMenuId({ step: "more" }), title: "Mais opções" },
        ]
      : [{ id: clientMenuId({ step: "more" }), title: "Mais opções" }, this.humanOption()];
    await this.sendChoice(body, options);
  }

  private async showMore(): Promise<void> {
    const links = this.ctx.capabilities.links;
    const options: MenuOption[] = [
      ...(links.isEnabled && links.items.length > 0
        ? [{ id: clientMenuId({ step: "links" }), title: "Links da empresa", description: links.items.map((link) => link.label).join(", ") }]
        : []),
      { id: clientMenuId({ step: "human" }), title: "Falar com atendente" },
      { id: clientMenuId({ step: "menu" }), title: "Voltar ao menu" },
    ];
    await this.sendChoice("Como posso ajudar? Você também pode escrever sua dúvida (endereços, horários, serviços, convênios).", options);
  }

  private async showLinks(): Promise<void> {
    const links = this.ctx.capabilities.links;
    if (!links.isEnabled || links.items.length === 0) return this.unavailable();
    await this.sendText(links.items.map((link) => `${link.label}: ${link.url}`).join("\n"));
  }

  private async transferToHuman(): Promise<void> {
    const transfer = makeTransferToHumanTool(this.ctx) as unknown as { execute: (input: unknown, options: { toolCallId: string; messages: [] }) => Promise<unknown> };
    await transfer.execute({ reason: "Cliente pediu atendente pelo menu", clientAsked: true }, { toolCallId: `menu-${Date.now()}`, messages: [] });
    await this.sendText("Vou passar seu atendimento para a nossa equipe, que continua por aqui.");
  }

  private async unavailable(): Promise<void> {
    await this.sendChoice("Essa opção não está mais disponível.", [this.backToMenu(), this.humanOption()]);
  }

  private async showAgendas(): Promise<void> {
    if (!this.hasAgenda) return this.unavailable();
    const output = await runAgendaTool(this.tools, "list_agendas", {});
    const agendas = (output.agendas as { agendaId: string; name: string }[] | undefined) ?? [];
    if (agendas.length === 0) return this.unavailable();
    if (agendas.length === 1) return this.showDays(agendas[0].agendaId, null);
    // Sempre em lista (quatro linhas ou mais): só a lista mostra o nome inteiro da agenda na descrição.
    await this.sendChoice(
      "O que você quer marcar?",
      [
        ...agendas.slice(0, MAX_LIST_ROWS - 1).map((agenda) => ({
          id: clientMenuId({ step: "days", agendaId: agenda.agendaId, appointmentId: null }),
          title: agenda.name,
        })),
        { id: clientMenuId({ step: "menu" }), title: "Voltar ao menu" },
        ...(agendas.length === 2 ? [this.humanOption()] : []),
      ],
      "Ver agendas",
    );
  }

  private async freeTimes(agendaId: string, date: string): Promise<string[] | null> {
    const output = await runAgendaTool(this.tools, "get_available_slots", { agendaId, date });
    if (output.error) return null;
    const slots = (output.slots as { startTime: string }[] | undefined) ?? [];
    return slots.map((slot) => slot.startTime);
  }

  private async showDays(agendaId: string, appointmentId: string | null): Promise<void> {
    const today = dayjs().tz(AGENDA_TIME_ZONE);
    const options: MenuOption[] = [];
    for (let offset = 0; offset < DAYS_TO_SCAN && options.length < DAYS_TO_OFFER; offset += 1) {
      const date = today.add(offset, "day").format("YYYY-MM-DD");
      const times = await this.freeTimes(agendaId, date);
      if (times === null) return this.unavailable();
      if (times.length === 0) continue;
      options.push({
        id: clientMenuId({ step: "slots", agendaId, date, appointmentId, page: 0 }),
        title: describeDay(date).short,
        description: `${times.length} ${times.length === 1 ? "horário livre" : "horários livres"}`,
      });
    }
    if (options.length === 0) {
      await this.sendChoice("Sem horários livres nos próximos dias.", [this.humanOption(), this.backToMenu()]);
      return;
    }
    await this.sendChoice(
      "Para qual dia? Se preferir outra data, escreva o dia que você quer.",
      [...options, { id: clientMenuId({ step: "menu" }), title: "Voltar ao menu" }],
      "Ver dias",
    );
  }

  private async showSlots(target: Extract<ClientMenuStep, { step: "slots" }>, notice?: string): Promise<void> {
    const times = await this.freeTimes(target.agendaId, target.date);
    if (times === null) return this.unavailable();
    const pageTimes = times.slice(target.page * SLOTS_PER_PAGE, (target.page + 1) * SLOTS_PER_PAGE);
    if (pageTimes.length === 0) return this.showDays(target.agendaId, target.appointmentId);
    const hasMore = times.length > (target.page + 1) * SLOTS_PER_PAGE;
    const options: MenuOption[] = [
      ...pageTimes.map((time) => ({
        id: clientMenuId({ step: "slot", agendaId: target.agendaId, date: target.date, time, appointmentId: target.appointmentId }),
        title: time,
      })),
      hasMore
        ? { id: clientMenuId({ ...target, page: target.page + 1 }), title: "Ver mais horários" }
        : { id: clientMenuId({ step: "days", agendaId: target.agendaId, appointmentId: target.appointmentId }), title: "Outro dia" },
    ];
    const question = `Qual horário na ${describeDay(target.date).long}?`;
    await this.sendChoice(notice ? `${notice}\n${question}` : question, options, "Ver horários");
  }

  private async agendaName(agendaId: string): Promise<string | null> {
    const output = await runAgendaTool(this.tools, "list_agendas", {});
    const agendas = (output.agendas as { agendaId: string; name: string }[] | undefined) ?? [];
    return agendas.find((agenda) => agenda.agendaId === agendaId)?.name ?? null;
  }

  private async askConfirmation(target: Extract<ClientMenuStep, { step: "slot" }>): Promise<void> {
    const agendaName = await this.agendaName(target.agendaId);
    if (!agendaName) return this.unavailable();
    const when = `${describeDay(target.date).long}, às ${target.time}`;
    await this.sendChoice(
      `${agendaName}\n${when.charAt(0).toUpperCase()}${when.slice(1)}\n\n${target.appointmentId ? "Posso remarcar para este horário?" : "Posso marcar?"}`,
      [
        { id: clientMenuId({ ...target, step: "confirm" }), title: "Confirmar" },
        { id: clientMenuId({ step: "menu" }), title: "Cancelar" },
      ],
    );
  }

  /** Agendamento futuro e ativo deste cliente, numa agenda liberada. É a checagem de posse do menu. */
  private async findOwnAppointment(appointmentId: string) {
    const scope = buildLeadAgendaScope(this.ctx);
    if (!scope) return null;
    return prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        leadId: scope.leadId,
        agendaId: { in: scope.agendaIds },
        agenda: { organizationId: scope.organizationId },
        status: { notIn: ["CANCELLED"] },
        startsAt: { gte: new Date() },
      },
      select: { id: true, agendaId: true, startsAt: true, agenda: { select: { name: true } } },
    });
  }

  private describeAppointment(appointment: { startsAt: Date; agenda: { name: string } }): string {
    const startsAt = dayjs(appointment.startsAt).tz(AGENDA_TIME_ZONE);
    return `${appointment.agenda.name}, ${describeDay(startsAt.format("YYYY-MM-DD")).long}, às ${startsAt.format("HH:mm")}`;
  }

  private async confirm(target: Extract<ClientMenuStep, { step: "confirm" }>): Promise<void> {
    const slotsTarget = { step: "slots" as const, agendaId: target.agendaId, date: target.date, appointmentId: target.appointmentId, page: 0 };
    const startsAt = dayjs.tz(`${target.date} ${target.time}`, AGENDA_TIME_ZONE).toDate();
    if (target.appointmentId) {
      if (!(await this.findOwnAppointment(target.appointmentId))) return this.unavailable();
      const output = await runAgendaTool(this.tools, "reschedule_my_appointment", {
        appointmentId: target.appointmentId,
        date: target.date,
        time: target.time,
      });
      if (!output.success) return this.showSlots(slotsTarget, "Esse horário não está mais disponível.");
      await this.sendChoice(`Remarcado para ${describeDay(target.date).long}, às ${target.time}.`, [this.backToMenu()]);
      return;
    }
    // Segundo clique em "Confirmar": o horário já é deste cliente, não é conflito.
    const alreadyBooked = await prisma.appointment.findFirst({
      where: { leadId: this.ctx.lead.id, agendaId: target.agendaId, startsAt, status: { notIn: ["CANCELLED"] } },
      select: { id: true },
    });
    if (alreadyBooked) {
      await this.sendChoice("Esse horário já está marcado para você.", [this.backToMenu()]);
      return;
    }
    const output = await runAgendaTool(this.tools, "book_appointment", { agendaId: target.agendaId, date: target.date, time: target.time });
    if (!output.success) return this.showSlots(slotsTarget, "Esse horário não está mais disponível.");
    const reminderNote = this.ctx.capabilities.reminder.isEnabled ? " Você recebe um lembrete antes do horário." : "";
    const link = typeof output.link === "string" ? `\n${output.link}` : "";
    await this.sendChoice(`Marcado! ${String(output.agendaName ?? "")}, ${describeDay(target.date).long}, às ${target.time}.${reminderNote}${link}`, [this.backToMenu()]);
  }

  private async showMine(): Promise<void> {
    if (!this.hasAgenda) return this.unavailable();
    const output = await runAgendaTool(this.tools, "list_my_appointments", {});
    const appointments = (output.appointments as { appointmentId: string; agendaName: string; date: string; time: string }[] | undefined) ?? [];
    if (appointments.length === 0) {
      await this.sendChoice("Você não tem agendamentos marcados.", [{ id: clientMenuId({ step: "book" }), title: "Agendar" }, this.backToMenu()]);
      return;
    }
    await this.sendChoice(
      "Seus agendamentos:",
      [
        ...appointments.slice(0, MAX_LIST_ROWS - 1).map((appointment) => ({
          id: clientMenuId({ step: "appointment", appointmentId: appointment.appointmentId }),
          title: `${appointment.date.slice(0, 5)} às ${appointment.time}`,
          description: appointment.agendaName,
        })),
        { id: clientMenuId({ step: "menu" }), title: "Voltar ao menu" },
      ],
      "Ver agendamentos",
    );
  }

  private async showAppointment(appointmentId: string): Promise<void> {
    const appointment = await this.findOwnAppointment(appointmentId);
    if (!appointment) return this.unavailable();
    await this.sendChoice(`${this.describeAppointment(appointment)}. O que deseja?`, [
      { id: clientMenuId({ step: "reschedule", appointmentId }), title: "Remarcar" },
      { id: clientMenuId({ step: "cancel", appointmentId }), title: "Cancelar horário" },
      { id: clientMenuId({ step: "mine" }), title: "Voltar" },
    ]);
  }

  private async askCancel(appointmentId: string): Promise<void> {
    const appointment = await this.findOwnAppointment(appointmentId);
    if (!appointment) return this.unavailable();
    await this.sendChoice(`Confirma o cancelamento de ${this.describeAppointment(appointment)}?`, [
      { id: clientMenuId({ step: "cancelConfirm", appointmentId }), title: "Confirmar" },
      { id: clientMenuId({ step: "menu" }), title: "Manter" },
    ]);
  }

  private async cancel(appointmentId: string): Promise<void> {
    const appointment = await this.findOwnAppointment(appointmentId);
    if (!appointment) return this.unavailable();
    const output = await runAgendaTool(this.tools, "cancel_my_appointment", { appointmentId });
    if (!output.success) return this.unavailable();
    await this.sendChoice("Agendamento cancelado.", [this.backToMenu()]);
  }

  async run(target: ClientMenuStep): Promise<void> {
    switch (target.step) {
      case "menu":
        return this.showMenu();
      case "more":
        return this.showMore();
      case "links":
        return this.showLinks();
      case "human":
        return this.transferToHuman();
      case "book":
        return this.showAgendas();
      case "mine":
        return this.showMine();
      case "days":
        if (!this.hasAgenda) return this.unavailable();
        if (target.appointmentId && !(await this.findOwnAppointment(target.appointmentId))) return this.unavailable();
        return this.showDays(target.agendaId, target.appointmentId);
      case "slots":
        return this.hasAgenda ? this.showSlots(target) : this.unavailable();
      case "slot":
        return this.hasAgenda ? this.askConfirmation(target) : this.unavailable();
      case "confirm":
        return this.hasAgenda ? this.confirm(target) : this.unavailable();
      case "appointment":
        return this.showAppointment(target.appointmentId);
      case "reschedule": {
        const appointment = await this.findOwnAppointment(target.appointmentId);
        if (!appointment) return this.unavailable();
        return this.showDays(appointment.agendaId, appointment.id);
      }
      case "cancel":
        return this.askCancel(target.appointmentId);
      case "cancelConfirm":
        return this.cancel(target.appointmentId);
    }
  }
}

/** Resposta "2" a uma pergunta enviada como lista numerada (número sem botão de verdade). */
async function resolveNumberedAnswer(conversationId: string, answer: string): Promise<string | null> {
  const lastOutbound = await prisma.message.findFirst({
    where: { conversationId, fromMe: true },
    orderBy: { createdAt: "desc" },
    select: { metadata: true },
  });
  const options = (lastOutbound?.metadata as { guidedOptions?: { id?: unknown }[] } | null)?.guidedOptions;
  const chosen = Array.isArray(options) ? options[Number(answer) - 1] : undefined;
  return typeof chosen?.id === "string" ? chosen.id : null;
}

/**
 * Trata a mensagem pelo menu quando ela é saudação ou clique do menu. `handled: false` devolve a
 * mensagem para a assistente (texto livre, áudio, clique de outro tipo de botão).
 */
export async function handleGuidedMenu(
  ctx: AgentContext,
  inboundMessageId: string,
  channel?: GuidedMenuChannel,
): Promise<{ handled: boolean }> {
  if (!ctx.capabilities.guidedMenu || ctx.catalogOrder || !ctx.lead.phone || !ctx.settings) return { handled: false };
  const inbound = await prisma.message.findFirst({
    where: { id: inboundMessageId, conversationId: ctx.conversation.id, fromMe: false },
    select: { body: true, mimetype: true, mediaType: true, metadata: true },
  });
  if (!inbound || inbound.mimetype || inbound.mediaType) return { handled: false };

  const clickedId = (inbound.metadata as { interactiveReplyId?: unknown } | null)?.interactiveReplyId;
  const text = normalize(inbound.body ?? "");
  let replyId: string | null = typeof clickedId === "string" ? clickedId : null;
  if (!replyId && NUMBERED_ANSWER.test(text)) replyId = await resolveNumberedAnswer(ctx.conversation.id, text);
  if (replyId && !isClientMenuId(replyId)) return { handled: false };
  if (!replyId && !GREETING_PATTERN.test(text)) return { handled: false };

  const clicksLastHour = await prisma.message.count({
    where: {
      conversationId: ctx.conversation.id,
      fromMe: true,
      createdAt: { gte: new Date(Date.now() - HOUR_MS) },
      metadata: { path: ["guidedMenu"], equals: true },
    },
  });
  if (clicksLastHour >= MAX_CLICKS_PER_HOUR) return { handled: true };

  const menu = new GuidedMenu(ctx, channel);
  const target = replyId ? parseClientMenuId(replyId) : ({ step: "menu" } as const);
  if (!target) {
    await menu.run({ step: "menu" });
    return { handled: true };
  }
  await menu.run(target);
  return { handled: true };
}
