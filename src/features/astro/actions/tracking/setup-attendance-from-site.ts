import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { meter } from "@/features/stars/lib/metering";
import { ASTRO_WRITE_DENIAL } from "@/features/astro/lib/permission-denial";
import { readSite } from "@/features/tracking-chat-ai/lib/site-reader/read-site";
import { UnsafeSiteAddressError, parsePublicSiteUrl, siteKey } from "@/features/tracking-chat-ai/lib/site-reader/safe-address";
import { extractAttendanceDraft } from "@/features/tracking-chat-ai/lib/attendance-setup/extract-draft";
import { applyAttendanceDraft } from "@/features/tracking-chat-ai/lib/attendance-setup/apply-draft";
import { attendanceDraftSchema, pickAssistantName, type AttendanceDraft } from "@/features/tracking-chat-ai/lib/attendance-setup/draft";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleTracking } from "./resolve-tracking";
import { TRACKING_FIELD_STEP } from "../leads/lead-steps";

// Monta o atendimento da empresa a partir do site dela (spec 0088): documento na Auto
// Inteligência, agendas e configuração da assistente. Tudo nasce desligado para revisão.

const APP_NAME = "Fluxo de atendimento";
const MAX_SITE_READS_PER_DAY = 5;
const SITE_READ_FEATURE_KEY = "astro.attendance.site_read";
const DAY_MS = 24 * 60 * 60_000;
const URL_IN_TEXT = /https?:\/\/[^\s"'<>)]+/i;
const BARE_DOMAIN_IN_TEXT = /\b((?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|med|adv|eng|app|io|site|online|store)(?:\.br)?(?:\/[^\s"'<>)]*)?)/i;

const inputSchema = z.object({
  siteUrl: z.string().trim().min(4).max(300).describe("Endereço do site da empresa, ex.: https://minhaempresa.com.br"),
  trackingName: z.string().trim().min(2).optional().describe("Funil onde o atendimento será montado."),
  siteOwnership: z.enum(["own", "other"]).optional(),
  draftJson: z.string().optional(),
});

function inferSiteFields(text: string): Record<string, unknown> {
  const siteUrl = text.match(URL_IN_TEXT)?.[0] ?? text.match(BARE_DOMAIN_IN_TEXT)?.[1];
  return siteUrl ? { siteUrl: siteUrl.replace(/[.,;!?]+$/, "") } : {};
}

function toHttpsUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/^http:\/\//i, "https://");
  return `https://${trimmed}`;
}

function failure(title: string, description: string): AstroActionResult {
  return { status: "error", title, description, appName: APP_NAME };
}

async function isOrgAdmin(ctx: AgentContext): Promise<boolean> {
  const member = await prisma.member.findFirst({
    where: { organizationId: ctx.organizationId, userId: ctx.userId },
    select: { role: true },
  });
  const role = member?.role?.toLowerCase();
  return role === "owner" || role === "admin";
}

async function loadActor(userId: string) {
  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, image: true } });
  return { userName: actor?.name ?? "—", userEmail: actor?.email ?? "—", userImage: actor?.image };
}

function parseDraft(draftJson: string | undefined): AttendanceDraft | null {
  if (!draftJson) return null;
  try {
    const parsed = attendanceDraftSchema.safeParse(JSON.parse(draftJson));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function listNames(names: string[], limit: number): string {
  const shown = names.slice(0, limit).join(", ");
  return names.length > limit ? `${shown} e mais ${names.length - limit}` : shown;
}

function describeProposal(draft: AttendanceDraft, trackingName: string, pagesRead: number | null, assistantName: string): string {
  const parts = [
    `Li ${pagesRead ? `${pagesRead} página(s) do` : "o"} site de ${draft.companyName} (${draft.businessType}). Em ${trackingName}, vou criar, tudo desligado para você revisar:`,
    `• Documento na Auto Inteligência com ${draft.units.length} unidade(s), ${draft.services.length} serviço(s) e ${draft.insurances.length} convênio(s).`,
    draft.suggestedAgendas.length > 0
      ? `• Agendas: ${listNames(draft.suggestedAgendas.map((agenda) => `${agenda.name} (${agenda.slotMinutes} min)`), 5)}.`
      : "• Nenhuma agenda: o site não mostra serviço com hora marcada.",
    `• Assistente "${assistantName}", com instruções de atendimento. Se o funil já tiver instruções escritas, elas ficam como estão.`,
    "• PIX, chamada de voz e resposta em áudio continuam desligados.",
  ];
  if (draft.gaps.length > 0) parts.push(`Falta no site (fica "A PREENCHER"): ${listNames(draft.gaps, 6)}.`);
  return parts.join("\n");
}

async function readAndExtract(params: { ctx: AgentContext; siteUrl: URL }): Promise<
  { draft: AttendanceDraft; pagesRead: number } | { failure: AstroActionResult }
> {
  const { ctx, siteUrl } = params;
  const readsToday = await prisma.systemActivityLog.count({
    where: {
      organizationId: ctx.organizationId,
      featureKey: SITE_READ_FEATURE_KEY,
      createdAt: { gte: new Date(Date.now() - DAY_MS) },
    },
  });
  if (readsToday >= MAX_SITE_READS_PER_DAY) {
    return { failure: failure("Limite de hoje atingido", `A empresa já leu ${MAX_SITE_READS_PER_DAY} sites nas últimas 24 horas. Tente de novo amanhã.`) };
  }

  let site: Awaited<ReturnType<typeof readSite>>;
  try {
    site = await readSite(siteUrl.toString());
  } catch (readError) {
    console.warn("[attendance-setup] leitura do site falhou", readError instanceof Error ? readError.message : "erro");
    return {
      failure: failure(
        "Não consegui ler esse site",
        "O site não respondeu ou não tem texto que eu consiga ler. Você pode escrever as informações da empresa num documento da Auto Inteligência.",
      ),
    };
  }
  const readableChars = site.pages.reduce((total, page) => total + page.text.length, 0);
  if (readableChars < 300) {
    return {
      failure: failure(
        "Não consegui ler esse site",
        "A página quase não tem texto (talvez seja montada só por script). Você pode escrever as informações da empresa num documento da Auto Inteligência.",
      ),
    };
  }

  const extraction = await extractAttendanceDraft(site.pages);
  await meter({
    organizationId: ctx.organizationId,
    action: "astro_attendance_setup_from_site",
    userId: ctx.userId,
    appSlug: "astro",
    description: `Astro — leitura do site ${siteKey(siteUrl.hostname)} para montar o atendimento`,
    feature: SITE_READ_FEATURE_KEY,
    cost: { kind: "LLM", provider: "openai", modelId: extraction.modelId, tokens: extraction.tokens },
  }).catch((chargeError) => console.warn("[attendance-setup] cobrança falhou", chargeError));

  await logActivity({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    ...(await loadActor(ctx.userId)),
    appSlug: "tracking",
    subAppSlug: "tracking-chat-ai",
    featureKey: SITE_READ_FEATURE_KEY,
    action: "attendance.site_read",
    actionLabel: `Pediu ao Astro para ler o site ${siteKey(siteUrl.hostname)} e montar o atendimento`,
    resource: siteKey(siteUrl.hostname),
    metadata: { via: "astro", pagesRead: site.pages.length, declaredOwnSite: true },
  });
  return { draft: extraction.draft, pagesRead: site.pages.length };
}

export const setupAttendanceFromSiteAction: AstroAction<typeof inputSchema> = {
  key: "attendance.setup_from_site",
  app: "tracking",
  toolName: "setup_attendance_from_site",
  description:
    "Monta o ATENDIMENTO AO CLIENTE da empresa a partir do SITE dela: lê o site e prepara o documento de informações, as agendas e a assistente do Fluxo de atendimento, tudo desligado para revisão. " +
    "Use para 'monte o atendimento com o site da minha empresa', 'configure a assistente a partir deste link', 'treine o atendimento com meu site'. " +
    "Não é criar site nem página.",
  permission: { appKey: "tracking", action: "edit" },
  requiresConfirmation: true,
  confirmTitle: "Montar o atendimento a partir do site",
  confirmWarnings: [
    "Nada é ligado sozinho: revise o documento, os horários das agendas e as instruções antes de ativar.",
    "O Astro só usa o que está no site. O que faltar fica marcado como A PREENCHER.",
  ],
  input: inputSchema,
  inferFields: inferSiteFields,
  // A posse do site e o rascunho nunca vêm do modelo: a primeira é resposta da pessoa, o segundo é do código.
  codeOnlyFields: ["siteOwnership", "draftJson"],
  intentPatterns: [
    /\b(monte|montar|monta|configure|configurar|configura|treine|treinar|treina|prepare|preparar|crie|criar)\b.*\b(atendimento|assistente|chatbot)\b.*\b(site|link|https?|www\.)/,
  ],
  fieldSteps: {
    siteUrl: {
      title: "Site da empresa",
      question: "Qual é o endereço do site da empresa?",
      picker: { kind: "text", placeholder: "https://minhaempresa.com.br", maxLength: 300 },
    },
    trackingName: TRACKING_FIELD_STEP,
  },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    if (!(await isOrgAdmin(ctx))) return failure("Sem permissão", ASTRO_WRITE_DENIAL);
    if (ctx.channel === "WHATSAPP") {
      return {
        status: "error",
        title: "Continue na plataforma",
        description: "Montar o atendimento pede uma revisão que não cabe aqui. Abra o Astro na plataforma e mande o link do site por lá.",
        internalUrl: "/astro",
        openLabel: "Abrir o Astro",
        appName: APP_NAME,
      };
    }

    let siteUrl: URL;
    try {
      siteUrl = parsePublicSiteUrl(toHttpsUrl(input.siteUrl));
    } catch (addressError) {
      if (!(addressError instanceof UnsafeSiteAddressError)) throw addressError;
      return {
        status: "needs_input",
        title: "Endereço do site",
        description: "Preciso do endereço público do site, começando com https://.",
        missingFields: [{ key: "siteUrl", label: "o endereço do site" }],
        appName: APP_NAME,
        picker: { kind: "text", placeholder: "https://minhaempresa.com.br", maxLength: 300 },
      };
    }
    const siteHost = siteKey(siteUrl.hostname);

    const resolved = await resolveSingleTracking({ ctx, name: input.trackingName, field: "trackingName" });
    if ("failure" in resolved) return resolved.failure;
    const tracking = resolved.tracking;

    if (!input.siteOwnership) {
      return {
        status: "needs_input",
        title: "Este é o site da sua empresa?",
        description: `Vou ler ${siteHost} para montar o atendimento. Este site é da sua empresa?`,
        missingFields: [{ key: "siteOwnership", label: "se o site é da sua empresa" }],
        appName: APP_NAME,
        picker: {
          kind: "select",
          options: [
            { label: "Sim, é da minha empresa", answer: "own" },
            { label: "Não", answer: "other" },
          ],
        },
      };
    }
    if (input.siteOwnership !== "own") {
      return failure("Só o site da própria empresa", "Eu só monto o atendimento com o site da sua própria empresa.");
    }

    let draft = parseDraft(input.draftJson);
    if (dryRun) {
      let pagesRead: number | null = null;
      if (!draft) {
        const outcome = await readAndExtract({ ctx, siteUrl });
        if ("failure" in outcome) return outcome.failure;
        draft = outcome.draft;
        pagesRead = outcome.pagesRead;
        // A confirmação guarda este mesmo objeto: o "sim" grava exatamente o que foi mostrado, sem ler o site de novo.
        input.draftJson = JSON.stringify(draft);
      }
      return {
        status: "done",
        title: "Montar o atendimento a partir do site",
        description: describeProposal(draft, tracking.name, pagesRead, pickAssistantName(siteHost)),
        appName: APP_NAME,
      };
    }

    if (!draft) {
      const outcome = await readAndExtract({ ctx, siteUrl });
      if ("failure" in outcome) return outcome.failure;
      draft = outcome.draft;
    }
    const confirmedDraft = draft;
    const applied = await prisma.$transaction((tx) =>
      applyAttendanceDraft(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        trackingId: tracking.id,
        siteHost,
        draft: confirmedDraft,
      }),
    );

    await logActivity({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      ...(await loadActor(ctx.userId)),
      appSlug: "tracking",
      subAppSlug: "tracking-chat-ai",
      featureKey: "astro.attendance.setup_created",
      action: "attendance.setup_created",
      actionLabel: `Montou o atendimento de "${tracking.name}" pelo Astro a partir do site ${siteHost}`,
      resource: tracking.name,
      resourceId: tracking.id,
      metadata: {
        via: "astro",
        siteHost,
        knowledgeId: applied.knowledgeId,
        wasKnowledgeUpdated: applied.wasKnowledgeUpdated,
        createdAgendas: applied.createdAgendaNames,
        keptExistingInstructions: applied.keptExistingInstructions,
      },
    });

    const summary = [
      applied.wasKnowledgeUpdated
        ? "Documento da empresa atualizado na Auto Inteligência e marcado para o atendimento."
        : "Documento da empresa criado na Auto Inteligência e marcado para o atendimento.",
      applied.createdAgendaNames.length > 0
        ? `Agendas criadas, desligadas: ${listNames(applied.createdAgendaNames, 5)}. Defina os horários e ative em Agendas.`
        : "Nenhuma agenda nova.",
      applied.skippedAgendaNames.length > 0 ? `Já existiam: ${listNames(applied.skippedAgendaNames, 5)}.` : "",
      applied.keptExistingInstructions
        ? "As instruções que o funil já tinha foram mantidas."
        : `Assistente "${applied.assistantName}" configurada, com o atendimento desligado.`,
      confirmedDraft.gaps.length > 0 ? `Preencha no documento: ${listNames(confirmedDraft.gaps, 6)}.` : "",
      "Quando revisar, ligue o atendimento em Fluxo de atendimento. Se quiser, peço em seguida os fluxos de atendimento do seu ramo.",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      status: "done",
      title: "Atendimento montado para revisão",
      description: summary,
      internalUrl: `/tracking/${tracking.id}/settings`,
      openLabel: "Revisar o Fluxo de atendimento",
      appName: APP_NAME,
    };
  },
};
