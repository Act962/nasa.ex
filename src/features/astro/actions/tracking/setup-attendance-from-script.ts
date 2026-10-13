import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { ASTRO_WRITE_DENIAL } from "@/features/astro/lib/permission-denial";
import { applyScriptDraft } from "@/features/tracking-chat-ai/lib/attendance-setup/apply-script-draft";
import { extractScriptDraft } from "@/features/tracking-chat-ai/lib/attendance-setup/extract-script-draft";
import {
  SCRIPT_LIMITS,
  buildScriptKnowledge,
  menuTitles,
  scriptDraftSchema,
  type ScriptDraft,
} from "@/features/tracking-chat-ai/lib/attendance-setup/script-draft";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleTracking } from "./resolve-tracking";
import { TRACKING_FIELD_STEP } from "../leads/lead-steps";

// Monta o atendimento a partir do roteiro que a empresa colou na conversa (spec 0091): documento na
// Auto Inteligência, instruções e nome da assistente, menu inicial, tags de interesse e um fluxo por
// assunto. Tudo desligado para revisão; o atendimento por IA não é ligado aqui.

const APP_NAME = "Fluxo de atendimento";
const MAX_SETUPS_PER_DAY = 5;
const SETUP_FEATURE_KEY = "astro.attendance.script_read";
const DAY_MS = 24 * 60 * 60_000;
const ATTENDANCE_WORDS = /\b(atendimento|assistente|whatsapp|chatbot)\b/i;

const inputSchema = z.object({
  scriptText: z.string().min(SCRIPT_LIMITS.minChars).max(SCRIPT_LIMITS.maxChars),
  trackingName: z.string().trim().min(2).optional().describe("Funil onde o atendimento será montado."),
  instructionsChoice: z.enum(["replace", "keep"]).optional(),
  draftJson: z.string().optional(),
});

/** Um roteiro colado é reconhecido pelo tamanho e pelo assunto, sem passar pelo classificador. */
function isPastedScript(text: string): boolean {
  return text.length >= SCRIPT_LIMITS.minChars * 3 && ATTENDANCE_WORDS.test(text);
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

function parseDraft(draftJson: string | undefined): ScriptDraft | null {
  if (!draftJson) return null;
  try {
    const parsed = scriptDraftSchema.safeParse(JSON.parse(draftJson));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function describeProposal(params: { draft: ScriptDraft; trackingId: string; trackingName: string; keepsInstructions: boolean }): string {
  const { draft } = params;
  const knowledge = buildScriptKnowledge({ draft, trackingId: params.trackingId, writtenAt: new Date() });
  const factCount = draft.generalFacts.length + draft.menuOptions.reduce((total, option) => total + option.facts.length, 0);
  const parts = [
    `Li o roteiro da ${draft.companyName}. Em ${params.trackingName}, vou criar, tudo desligado para você revisar:`,
    `• Documento na Auto Inteligência com ${factCount - knowledge.droppedFacts} respostas, separadas por assunto.`,
    params.keepsInstructions
      ? "• As instruções que o funil já tem ficam como estão."
      : `• Assistente "${draft.assistantName ?? "Assistente"}", com ${draft.behaviorRules.length} regras de comportamento do roteiro.`,
    draft.menuOptions.length > 0
      ? `• Menu inicial com ${draft.menuOptions.length} opções: ${menuTitles(draft.menuOptions).join(", ")}.`
      : "• Nenhum menu: o roteiro não tem opções iniciais.",
    draft.menuOptions.length > 0
      ? `• ${draft.menuOptions.length} tags de interesse e ${draft.menuOptions.length} fluxos (um por assunto), que enviam a abertura do roteiro quando a tag entra.`
      : "",
    knowledge.droppedFacts > 0 ? `O roteiro é longo: ${knowledge.droppedFacts} respostas ficaram de fora do documento para caber no limite. Revise o que faltar.` : "",
    ...(draft.inconsistencies.length > 0
      ? ["Achei pontos que se contradizem no roteiro. Confira antes de ligar:", ...draft.inconsistencies.map((inconsistency) => `• ${inconsistency}`)]
      : []),
  ];
  return parts.filter(Boolean).join("\n");
}

export const setupAttendanceFromScriptAction: AstroAction<typeof inputSchema> = {
  key: "attendance.setup_from_script",
  app: "tracking",
  toolName: "setup_attendance_from_script",
  description:
    "Monta o ATENDIMENTO AO CLIENTE da empresa a partir de um ROTEIRO longo que a pessoa colou na conversa (o texto que ela usava para treinar um assistente: regras, menu, perguntas e respostas). " +
    "Cria documento de informações, instruções da assistente, menu inicial, tags e fluxos, tudo desligado para revisão. " +
    "Não é para pedido curto de um fluxo só (use create_automation_flow) nem para link de site (use setup_attendance_from_site).",
  permission: { appKey: "tracking", action: "edit" },
  requiresConfirmation: true,
  confirmTitle: "Montar o atendimento a partir do roteiro",
  confirmWarnings: [
    "Nada é ligado sozinho: revise o documento, o menu e os fluxos antes de ativar.",
    "O Astro só usa o que está no roteiro. Pontos que se contradizem aparecem na lista para você decidir.",
  ],
  input: inputSchema,
  // O roteiro é a própria mensagem colada; o rascunho e a escolha das instruções são do código e da pessoa.
  inferFields: (text) => (isPastedScript(text) ? { scriptText: text.slice(0, SCRIPT_LIMITS.maxChars) } : {}),
  claimsText: isPastedScript,
  codeOnlyFields: ["scriptText", "instructionsChoice", "draftJson"],
  fieldSteps: {
    scriptText: {
      title: "Roteiro de atendimento",
      question: "Cole aqui o roteiro de atendimento da empresa (regras, menu, perguntas e respostas).",
      picker: { kind: "text", placeholder: "Cole o roteiro", maxLength: SCRIPT_LIMITS.maxChars },
    },
    trackingName: TRACKING_FIELD_STEP,
  },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    if (!(await isOrgAdmin(ctx))) return failure("Sem permissão", ASTRO_WRITE_DENIAL);
    if (ctx.channel === "WHATSAPP") {
      return {
        status: "error",
        title: "Continue na plataforma",
        description: "Montar o atendimento pede uma revisão que não cabe aqui. Abra o Astro na plataforma e cole o roteiro por lá.",
        internalUrl: "/astro",
        openLabel: "Abrir o Astro",
        appName: APP_NAME,
      };
    }

    const resolved = await resolveSingleTracking({ ctx, name: input.trackingName, field: "trackingName" });
    if ("failure" in resolved) return resolved.failure;
    const tracking = resolved.tracking;

    const currentSettings = await prisma.aiSettings.findUnique({ where: { trackingId: tracking.id }, select: { prompt: true } });
    const hasWrittenInstructions = Boolean(currentSettings?.prompt?.trim());
    if (hasWrittenInstructions && !input.instructionsChoice) {
      return {
        status: "needs_input",
        title: "O funil já tem instruções",
        description: `${tracking.name} já tem instruções de atendimento escritas. Quer trocar pelas do roteiro?`,
        missingFields: [{ key: "instructionsChoice", label: "se troca as instruções" }],
        appName: APP_NAME,
        picker: {
          kind: "select",
          options: [
            { label: "Trocar pelas do roteiro", answer: "replace" },
            { label: "Manter as que já tem", answer: "keep" },
          ],
        },
      };
    }
    const keepsInstructions = hasWrittenInstructions && input.instructionsChoice !== "replace";

    let draft = parseDraft(input.draftJson);
    if (!draft) {
      const setupsToday = await prisma.systemActivityLog.count({
        where: { organizationId: ctx.organizationId, featureKey: SETUP_FEATURE_KEY, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
      });
      if (setupsToday >= MAX_SETUPS_PER_DAY) {
        return failure("Limite de hoje atingido", `A empresa já organizou ${MAX_SETUPS_PER_DAY} roteiros nas últimas 24 horas. Tente de novo amanhã.`);
      }
      try {
        draft = (await extractScriptDraft(input.scriptText)).draft;
      } catch (extractionError) {
        console.warn("[attendance-script] organização do roteiro falhou", extractionError instanceof Error ? extractionError.message : "erro");
        return failure("Não consegui organizar o roteiro", "Tente de novo. Se o roteiro for muito longo, envie um assunto por vez.");
      }
      await logActivity({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        ...(await loadActor(ctx.userId)),
        appSlug: "tracking",
        subAppSlug: "tracking-chat-ai",
        featureKey: SETUP_FEATURE_KEY,
        action: "attendance.script_read",
        actionLabel: `Pediu ao Astro para montar o atendimento de "${tracking.name}" a partir de um roteiro`,
        resource: tracking.name,
        resourceId: tracking.id,
        metadata: { via: "astro", scriptChars: input.scriptText.length, menuOptions: draft.menuOptions.length },
      });
      // A confirmação guarda este mesmo objeto: o "sim" grava exatamente o que foi mostrado.
      input.draftJson = JSON.stringify(draft);
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Montar o atendimento a partir do roteiro",
        description: describeProposal({ draft, trackingId: tracking.id, trackingName: tracking.name, keepsInstructions }),
        appName: APP_NAME,
      };
    }

    const confirmedDraft = draft;
    const applied = await prisma.$transaction(
      (tx) =>
        applyScriptDraft(tx, {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          trackingId: tracking.id,
          draft: confirmedDraft,
          shouldReplaceInstructions: !keepsInstructions,
        }),
      { timeout: 30_000 },
    );

    await logActivity({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      ...(await loadActor(ctx.userId)),
      appSlug: "tracking",
      subAppSlug: "tracking-chat-ai",
      featureKey: "astro.attendance.script_setup_created",
      action: "attendance.script_setup_created",
      actionLabel: `Montou o atendimento de "${tracking.name}" pelo Astro a partir de um roteiro`,
      resource: tracking.name,
      resourceId: tracking.id,
      metadata: {
        via: "astro",
        knowledgeId: applied.knowledgeId,
        createdFlows: applied.createdFlowNames,
        createdTags: applied.createdTagNames,
        keptExistingInstructions: applied.keptExistingInstructions,
      },
    });

    const summary = [
      applied.wasKnowledgeUpdated ? "Documento do roteiro atualizado na Auto Inteligência." : "Documento do roteiro criado na Auto Inteligência e marcado para o atendimento.",
      applied.keptExistingInstructions
        ? "As instruções do funil ficaram como estavam."
        : `Assistente "${applied.assistantName}" configurada com as regras do roteiro.`,
      `Menu inicial ${applied.wasMenuUpdated ? "atualizado" : "criado"} em Fluxo de atendimento › Presets de botões.`,
      applied.turnedOffGuidedMenu
        ? "O menu fixo de agendamento por botões foi desligado neste funil, para o menu do roteiro aparecer. Dá para religar em Fluxo de atendimento."
        : "",
      applied.createdFlowNames.length > 0 ? `Fluxos criados, desligados: ${applied.createdFlowNames.join("; ")}.` : "",
      applied.skippedFlowNames.length > 0 ? `Já existiam e não foram refeitos: ${applied.skippedFlowNames.join("; ")}.` : "",
      "Revise o documento e os fluxos, depois ligue os fluxos e o atendimento.",
    ];
    return {
      status: "done",
      title: "Atendimento montado, tudo desligado",
      description: summary.filter(Boolean).join("\n"),
      internalUrl: `/tracking/${tracking.id}/workflows`,
      openLabel: "Ver os fluxos",
      appName: APP_NAME,
    };
  },
};
