import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import type { AstroAction, AstroActionResult } from "../types";
import { formatAgendaDateTime, formatAgendaTime, resolveWhenOrAsk } from "./schedule-steps";
import { resolveSingleLead } from "../leads/resolve-lead";
import { rankBySimilarity } from "../fuzzy-match";
import { parsePickedAnswer, type AstroPicker } from "@/features/astro/lib/astro-picker";

// Marcar compromisso. Sem este verbo, "marca uma reunião com o Kauê sexta às
// 15h" caía em `agenda.reschedule_appointment`, que procura um agendamento
// que ainda não existe e responde que não achou.

const DEFAULT_DURATION_MINUTES = 60;
const WHATSAPP_NOTICE_LEAD_MINUTES = 60;
const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

const inputSchema = z.object({
  startsAt: z
    .string()
    .trim()
    .optional()
    .describe("Quando, com as palavras do usuário: 'sexta às 15h', 'amanhã 9h'."),
  title: z.string().trim().min(2).max(120).optional().describe("Assunto da reunião."),
  leadName: z
    .string()
    .trim()
    .min(2)
    .optional()
    .describe("Cliente do compromisso, quando o usuário disser."),
  agendaName: z
    .string()
    .trim()
    .min(2)
    .optional()
    .describe("Agenda onde marcar. Sem isso, usa a única da organização."),
  durationMinutes: z
    .number()
    .int()
    .min(5)
    .max(24 * 60)
    .optional()
    .describe("Duração em minutos. Sem isso, 60."),
  spokenWhen: z.string().optional().describe("Frase original do usuário."),
  answeredWhen: z
    .string()
    .optional()
    .describe("Resposta do usuário à pergunta de data/hora."),
  notifyPhone: z
    .string()
    .trim()
    .optional()
    .describe("WhatsApp para avisar do compromisso, quando o usuário pedir."),
  confirmedTitle: z.string().trim().optional().describe("Título escolhido no roteiro."),
  meetingPlace: z.string().trim().optional().describe("Online ou presencial, escolhido no roteiro."),
});

const MEETING_PLACE_OPTIONS = [
  { label: "Online", answer: "Online" },
  { label: "Presencial", answer: "Presencial" },
];

function toMeetingType(answer: string): "ONLINE" | "IN_PERSON" | null {
  const normalized = answer
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/\b(online|on-line|video|chamada|meet|remot[oa]|virtual)\b/.test(normalized)) return "ONLINE";
  if (/\b(presencial|pessoalmente|no local|escritorio|loja|visita)\b/.test(normalized)) return "IN_PERSON";
  return null;
}

/** "consulta", "call", "visita" ditos na frase viram o começo do título sugerido. */
function suggestTitle(spokenText: string, leadName?: string): string {
  const kind =
    spokenText.match(/\b(consulta|reuni[aã]o|call|visita|atendimento|apresenta[cç][aã]o|demonstra[cç][aã]o)\b/i)?.[1] ??
    "Reunião";
  const capitalizedKind = kind.charAt(0).toUpperCase() + kind.slice(1).toLowerCase();
  return leadName ? `${capitalizedKind} com ${leadName}` : capitalizedKind;
}

const WHATSAPP_WORDS = /\b(whats\s*app|whats|zap|wpp)\b/;
const PHONE_PATTERN = /(?:\+?55\s*)?\(?\d{2}\)?\s*9?\s*\d{4}[-\s]?\d{4}/;

function mentionsWhatsApp(text: string): boolean {
  return WHATSAPP_WORDS.test(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""),
  );
}

/**
 * A frase inteira vai junto, sem IA: o classificador não sabe que dia é hoje
 * (devolveu 2023-10-02 para "segunda às 14h") e costuma largar a segunda
 * metade de um pedido composto, como "e me avisa no WhatsApp".
 */
function inferAppointmentFields(text: string): Record<string, unknown> {
  if (!text) return {};
  const inferred: Record<string, unknown> = { spokenWhen: text };
  // "com o Kauê", "com a Maria Clara": nome próprio logo depois do "com".
  const withPerson = text.match(
    /\bcom\s+(?:o|a|os|as)?\s*([A-ZÀ-Ý][\wÀ-ÿ]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ]+)?)/u,
  );
  if (withPerson) inferred.leadName = withPerson[1];
  return inferred;
}

/** DDD + número vira 55 + DDD + número, que é o formato do envio. */
function toWhatsAppNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}




const LEAD_PICKER: AstroPicker = {
  kind: "entity",
  entity: "lead",
  placeholder: "Buscar lead por nome ou telefone",
  noneOption: { label: "Sem lead (compromisso interno)", answer: "sem lead" },
};
const AGENDA_PICKER: AstroPicker = { kind: "entity", entity: "agenda", placeholder: "Buscar agenda" };

const NO_LEAD_ANSWER = /^(sem lead|sem cliente|ningu[eé]m|nenhum|interno|s[oó] eu|sozinho)\.?$/i;
const BUSINESS_DAY_END_HOUR = 20;
const BUSINESS_DAY_START_HOUR = 8;

/** Próximo horário livre na mesma agenda, a partir do fim do conflito. */
async function findNextFreeSlot(params: {
  agendaId: string;
  from: Date;
  durationMinutes: number;
}): Promise<Date | null> {
  const durationMs = params.durationMinutes * 60_000;
  let candidate = new Date(params.from);
  for (let attempt = 0; attempt < 24; attempt++) {
    const hourInBrazil = Number(
      candidate.toLocaleString("pt-BR", { timeZone: BRAZIL_TIME_ZONE, hour: "2-digit", hour12: false }),
    );
    if (hourInBrazil >= BUSINESS_DAY_END_HOUR || hourInBrazil < BUSINESS_DAY_START_HOUR) {
      const hoursUntilStart = (24 - hourInBrazil + BUSINESS_DAY_START_HOUR) % 24 || 24;
      candidate = new Date(candidate.getTime() + hoursUntilStart * 60 * 60_000);
      candidate.setUTCMinutes(0, 0, 0);
    }
    const overlapping = await prisma.appointment.findFirst({
      where: {
        agendaId: params.agendaId,
        status: { not: "CANCELLED" },
        startsAt: { lt: new Date(candidate.getTime() + durationMs) },
        endsAt: { gt: candidate },
      },
      select: { endsAt: true },
    });
    if (!overlapping) return candidate;
    candidate = new Date(overlapping.endsAt);
  }
  return null;
}

export const createAppointmentAction: AstroAction<typeof inputSchema> = {
  key: "appointment.create",
  app: "agenda",
  toolName: "create_appointment_slot",
  description:
    "MARCA um compromisso novo — 'marca uma reunião com o Fulano sexta às 15h', 'agenda uma call amanhã às 9h'. " +
    "É criar do zero; remarcar um que já existe é outro verbo.",
  permission: { appKey: "spacetime", action: "create" },
  // Data errada custa um cliente esperando: o cartão mostra o dia por extenso
  // antes de gravar (spec 0033, RF-4).
  requiresConfirmation: true,
  confirmTitle: "Marcar compromisso",
  input: inputSchema,
  inferFields: inferAppointmentFields,
  codeOnlyFields: ["spokenWhen", "answeredWhen", "confirmedTitle", "meetingPlace"],
  intentPatterns: [
    /\b(quero|queria|preciso|gostaria de|vamos)\s+(agendar|marcar)\b/,
    /\b(marca|marque|marcar|agenda|agende|agendar)\b.{0,40}\b(reuniao|compromisso|consulta|call|visita|atendimento|horario|encontro)\b/,
    /\b(cria|criar|crie)\s+(um|uma)?\s*(agenda|agendamento|compromisso)\b.{0,60}\b(amanha|hoje|segunda|terca|quarta|quinta|sexta|sabado|domingo|\d{1,2}\s*h|\d{1,2}\/\d{1,2}|dia \d)/,
  ],

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    // Data e hora saem só das palavras do usuário: a frase original e as
    // respostas às perguntas. O `startsAt` do classificador só vale quando
    // não há frase (chamada pelo orquestrador) — ele já inventou 00:00 para
    // "amanhã" sem hora. A resposta vem na frente: "quinta 9h" vence "segunda".
    const resolvedWhen = resolveWhenOrAsk({
      answeredWhen: input.answeredWhen,
      spokenWhen: input.spokenWhen,
      startsAt: input.startsAt,
      verb: "marco",
    });
    if ("ask" in resolvedWhen) return resolvedWhen.ask;
    const startsAtIso = resolvedWhen.iso;

    const pickedAgenda = input.agendaName ? parsePickedAnswer(input.agendaName) : null;
    const agendas = await prisma.agenda.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(pickedAgenda?.id
          ? { id: pickedAgenda.id }
          : pickedAgenda
            ? { name: { contains: pickedAgenda.label, mode: "insensitive" } }
            : {}),
      },
      select: { id: true, name: true, slotDuration: true },
      take: 5,
    });

    if (agendas.length === 0 && input.agendaName) {
      // Erro de digitação vira sugestão, não "não achei" (spec 0033, RF-2).
      const allAgendas = await prisma.agenda.findMany({
        where: { organizationId: ctx.organizationId },
        select: { id: true, name: true },
        take: 200,
      });
      const similarAgendas = rankBySimilarity(pickedAgenda?.label ?? input.agendaName, allAgendas);
      if (similarAgendas.length > 0) {
        return {
          status: "ambiguous",
          title: "Em qual agenda?",
          description: `Não achei "${pickedAgenda?.label ?? input.agendaName}". Você quis dizer ${similarAgendas[0].name}?`,
          field: "agendaName",
          options: similarAgendas.map((agenda) => ({ id: agenda.id, label: agenda.name })),
          appName: "Agendas",
          picker: AGENDA_PICKER,
        };
      }
    }

    if (agendas.length === 0) {
      return {
        status: "needs_input",
        title: "Agenda não encontrada",
        description: input.agendaName
          ? `Não achei agenda com "${input.agendaName}".`
          : "Você ainda não tem agenda nenhuma. Crie uma antes de marcar.",
        missingFields: [{ key: "agendaName", label: "o nome da agenda" }],
        appName: "Agendas",
      };
    }

    if (agendas.length > 1) {
      return {
        status: "ambiguous",
        title: "Em qual agenda?",
        description: "Em qual agenda eu marco?",
        field: "agendaName",
        options: agendas.map((agenda) => ({ id: agenda.id, label: agenda.name })),
        appName: "Agendas",
        picker: AGENDA_PICKER,
      };
    }

    const agenda = agendas[0];

    // "Com quem" é pergunta, não campo opcional esquecido (spec 0033, RF-5).
    if (!input.leadName) {
      return {
        status: "needs_input",
        title: "Com quem?",
        description: "Com quem é o compromisso? Busque o lead ou marque como interno.",
        missingFields: [{ key: "leadName", label: "com quem é" }],
        appName: "Agendas",
        picker: LEAD_PICKER,
      };
    }

    let leadId: string | undefined;
    let leadName: string | undefined;
    if (!NO_LEAD_ANSWER.test(input.leadName.trim())) {
      const resolved = await resolveSingleLead({
        ctx,
        name: input.leadName,
        field: "leadName",
        appName: "Agendas",
      });
      if ("failure" in resolved) return resolved.failure;
      leadId = resolved.lead.id;
      leadName = resolved.lead.name;
    }

    // Roteiro (spec 0033, RF-9): título e "onde" também saem de seletor.
    if (!input.confirmedTitle || input.confirmedTitle.length < 2) {
      return {
        status: "needs_input",
        title: "Qual o título?",
        description: "Confirme ou ajuste o título do compromisso.",
        missingFields: [{ key: "confirmedTitle", label: "o título" }],
        appName: "Agendas",
        picker: {
          kind: "text",
          suggestion: input.title ?? suggestTitle(input.spokenWhen ?? "", leadName),
          placeholder: "Ex.: Consulta com Maria Clara",
          maxLength: 120,
        },
      };
    }
    const meetingType = input.meetingPlace ? toMeetingType(input.meetingPlace) : null;
    if (!meetingType) {
      return {
        status: "needs_input",
        title: "Onde?",
        description: "O compromisso é online ou presencial?",
        missingFields: [{ key: "meetingPlace", label: "onde" }],
        appName: "Agendas",
        picker: { kind: "select", options: MEETING_PLACE_OPTIONS },
      };
    }

    const startsAt = new Date(startsAtIso);
    const durationMinutes =
      input.durationMinutes ?? agenda.slotDuration ?? DEFAULT_DURATION_MINUTES;
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

    // Marcar por cima de compromisso existente é o erro caro deste verbo: quem
    // fala rápido não confere a agenda antes.
    const conflict = await prisma.appointment.findFirst({
      where: {
        agendaId: agenda.id,
        status: { not: "CANCELLED" },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { title: true, startsAt: true },
    });
    if (conflict) {
      const nextFreeSlot = await findNextFreeSlot({
        agendaId: agenda.id,
        from: startsAt,
        durationMinutes,
      });
      return {
        status: "needs_input",
        title: "Horário ocupado",
        description:
          `Horário ocupado: já existe "${conflict.title ?? "um compromisso"}" em ${formatAgendaDateTime(conflict.startsAt)} ` +
          `na agenda ${agenda.name}.` +
          (nextFreeSlot
            ? ` O próximo horário livre é ${formatAgendaDateTime(nextFreeSlot)}. Marco nele ou em outro horário?`
            : " Para quando eu marco?"),
        missingFields: [{ key: "answeredWhen", label: "outro horário" }],
        appName: "Agendas",
        picker: {
          kind: "datetime",
          mode: "datetime",
          suggestedIso: nextFreeSlot?.toISOString(),
        },
      };
    }

    const title = input.confirmedTitle;
    const placeLabel = meetingType === "ONLINE" ? "online" : "presencial";

    const spokenText = input.spokenWhen ?? "";
    const wantsWhatsApp = Boolean(input.notifyPhone) || mentionsWhatsApp(spokenText);
    let noticePhone: string | null = null;
    if (wantsWhatsApp) {
      const rawPhone =
        spokenText.match(PHONE_PATTERN)?.[0] ??
        input.notifyPhone ??
        (
          await prisma.user.findUnique({
            where: { id: ctx.userId },
            select: { phone: true },
          })
        )?.phone ??
        null;
      noticePhone = rawPhone ? toWhatsAppNumber(rawPhone) : null;
      if (!noticePhone) {
        return {
          status: "needs_input",
          title: "Qual WhatsApp?",
          description: "Me diga o número de WhatsApp (com DDD) para eu mandar o aviso.",
          missingFields: [{ key: "notifyPhone", label: "o WhatsApp com DDD" }],
          appName: "Agendas",
        };
      }
    }

    // O aviso sai pela instância de um funil da própria org — é o único canal
    // de envio que o lembrete sabe usar.
    const noticeTracking = noticePhone
      ? await prisma.tracking.findFirst({
          where: {
            organizationId: ctx.organizationId,
            whatsappInstance: { status: "CONNECTED", isActive: true },
          },
          select: { id: true },
        })
      : null;

    const remindAt = new Date(
      Math.max(startsAt.getTime() - WHATSAPP_NOTICE_LEAD_MINUTES * 60_000, Date.now() + 60_000),
    );
    const noticeSummary = !noticePhone
      ? ""
      : noticeTracking
        ? ` Aviso no WhatsApp ${noticePhone} às ${formatAgendaDateTime(remindAt)}.`
        : " Não consigo avisar no WhatsApp: nenhum número da empresa está conectado.";

    if (dryRun) {
      return {
        status: "done",
        title: "Marcar compromisso",
        description: `"${title}" em ${formatAgendaDateTime(startsAt)}, ${placeLabel}, na agenda ${agenda.name}.${noticeSummary}`,
        appName: "Agendas",
      };
    }

    await prisma.appointment.create({
      data: {
        title,
        startsAt,
        endsAt,
        meetingType,
        agendaId: agenda.id,
        leadId: leadId ?? null,
        userId: ctx.userId,
      },
    });

    if (noticePhone && noticeTracking) {
      const reminder = await prisma.reminder.create({
        data: {
          createdByUserId: ctx.userId,
          message: `Lembrete do ASTRO: "${title}" às ${formatAgendaTime(startsAt)}, na agenda ${agenda.name}.`,
          recurrenceType: "ONCE",
          remindTime: formatAgendaTime(remindAt),
          notifyPhone: noticePhone,
          nextRemindAt: remindAt,
          trackingId: noticeTracking.id,
          leadId: leadId ?? null,
        },
        select: { id: true },
      });
      // O disparo mora no Inngest, que hiberna até a hora do aviso.
      await inngest.send({ name: "reminder/created", data: { reminderId: reminder.id } });
    }

    return {
      status: "done",
      title: "Compromisso marcado",
      description: `"${title}" em ${formatAgendaDateTime(startsAt)}, na agenda ${agenda.name}.${noticeSummary}`,
      internalUrl: "/agendas",
      openLabel: "Abrir Agendas",
      appName: "Agendas",
    };
  },
};
