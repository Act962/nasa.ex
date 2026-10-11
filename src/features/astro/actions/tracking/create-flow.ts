import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { ASTRO_WRITE_DENIAL } from "@/features/astro/lib/permission-denial";
import { hasAppPermission } from "@/features/permissions/server/app-permission";
import { orderedStepTypes } from "@/features/automations-hub/lib/flow-steps";
import { executionNodes, triggerNodes } from "@/features/tracking-executions/lib/node-options";
import { createWorkflowFromBlueprint, type Blueprint } from "@/features/workflows/lib/agent-presets/create-from-blueprint";
import { findOrCreateTags, type TagRequest } from "@/features/workflows/lib/agent-presets/find-or-create-tags";
import {
  GeneratedBlueprintSchema,
  findFlowTracking,
  generateFlowBlueprint,
  predictBlueprintProblems,
  type GeneratedBlueprint,
} from "@/features/astro/server/tools/workflows/generate-flow";
import type { FlowChannelProvider } from "@/features/workflows/lib/flow-diagnostics";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleTracking } from "./resolve-tracking";
import { TRACKING_FIELD_STEP } from "../leads/lead-steps";

// "Criar fluxo com ASTRO" (spec 0090, seção D): a pessoa descreve a automação, o Astro mostra o
// roteiro e os problemas previstos, e só cria depois do "sim". O fluxo nasce desligado.

const APP_NAME = "Gatilhos Automáticos";
const MAX_ROUTE_STEPS = 8;
const MAX_FLOW_NODES = 40;
// Mais de uma opção do painel usa o mesmo tipo (Enviar Mensagem e Menu de Botões): vale a primeira.
const STEP_LABELS = new Map<string, string>();
for (const option of [...triggerNodes, ...executionNodes]) {
  if (!STEP_LABELS.has(String(option.type))) STEP_LABELS.set(String(option.type), option.label);
}
const CHANNEL_NOTE: Record<FlowChannelProvider, string> = {
  meta: "Este funil usa a API oficial do WhatsApp: fora das 24 h só sai mensagem com template.",
  uazapi: "",
  none: "Este funil ainda não tem número de WhatsApp conectado: as mensagens só saem depois de conectar um.",
};

const inputSchema = z.object({
  flowRequest: z
    .string()
    .trim()
    .min(10)
    .max(1500)
    .describe("O que a automação deve fazer, nas palavras da pessoa: quando começa, o que envia ou muda, e os prazos."),
  trackingName: z.string().trim().min(2).optional().describe("Funil onde o fluxo será criado."),
  blueprintJson: z.string().optional(),
});

function failure(title: string, description: string): AstroActionResult {
  return { status: "error", title, description, appName: APP_NAME };
}

function parseBlueprint(blueprintJson: string | undefined): GeneratedBlueprint | null {
  if (!blueprintJson) return null;
  try {
    const parsed = GeneratedBlueprintSchema.safeParse(JSON.parse(blueprintJson));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function describeRoute(blueprint: GeneratedBlueprint): string {
  const stepTypes = orderedStepTypes(
    blueprint.nodes.map((node) => ({ id: node.id, type: node.type })),
    blueprint.edges,
    MAX_ROUTE_STEPS,
  );
  const route = stepTypes.map((stepType) => STEP_LABELS.get(stepType) ?? stepType).join(" → ");
  const remaining = blueprint.nodes.length - stepTypes.length;
  return remaining > 0 ? `${route} (e mais ${remaining} passo(s) em outros caminhos)` : route;
}

function describeProposal(blueprint: GeneratedBlueprint, trackingName: string, provider: FlowChannelProvider): string {
  const problems = predictBlueprintProblems(blueprint, provider);
  const reviewCount = blueprint.nodes.filter((node) => node.data.needsReview === true).length;
  const parts = [
    `Vou criar em ${trackingName}, desligado para você revisar, o fluxo "${blueprint.name}".`,
    blueprint.description ?? "",
    `Roteiro: ${describeRoute(blueprint)}.`,
    blueprint.suggestedTags.length > 0
      ? `Tags usadas: ${blueprint.suggestedTags.map((tag) => tag.name).join(", ")} (as que não existirem serão criadas).`
      : "",
    reviewCount > 0 ? `${reviewCount} passo(s) pedem uma escolha sua no editor (ficam marcados em vermelho).` : "",
    CHANNEL_NOTE[provider],
    ...problems.map((problem) => `• ${problem.severity === "error" ? "Problema" : "Atenção"}: ${problem.title}. ${problem.message}`),
  ];
  return parts.filter(Boolean).join("\n");
}

export const createFlowAction: AstroAction<typeof inputSchema> = {
  key: "workflow.create_with_astro",
  app: "tracking",
  toolName: "create_automation_flow",
  description:
    "Cria um FLUXO DE AUTOMAÇÃO (gatilho automático) num funil a partir da descrição da pessoa: quando começa, o que envia ou muda e os prazos. " +
    "Mostra o roteiro, pede confirmação e cria o fluxo desligado para revisão no editor. " +
    "Use para 'crie um fluxo para…', 'crie um gatilho que…', 'monte uma automação que…', 'quando o lead receber a tag X, envie…'. " +
    "Não é criar funil, tag nem lembrete pessoal.",
  permission: { appKey: "tracking", action: "create" },
  requiresConfirmation: true,
  confirmTitle: "Criar fluxo de automação",
  confirmWarnings: [
    "O fluxo nasce desligado: revise os passos no editor antes de ligar.",
    "Passos marcados em vermelho pedem uma escolha sua (agenda, produto, template…).",
  ],
  input: inputSchema,
  // O roteiro mostrado na confirmação é guardado pelo código: o "sim" cria exatamente o que foi mostrado.
  codeOnlyFields: ["blueprintJson"],
  intentPatterns: [
    /\b(crie|criar|cria|monte|montar|monta|gere|gerar)\b.*\b(fluxo(?! de caixa)|gatilho|automacao)\b/,
  ],
  fieldSteps: {
    flowRequest: {
      title: "O que o fluxo deve fazer?",
      question: "Descreva: quando começa, o que envia ou muda, e os prazos.",
      picker: { kind: "text", placeholder: "Quando o lead receber a tag Orçamento, enviar…", maxLength: 1500 },
    },
    trackingName: TRACKING_FIELD_STEP,
  },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    if (!(await hasAppPermission(ctx.organizationId, ctx.userId, "tracking-automacoes", "canCreate"))) {
      return failure("Sem permissão", ASTRO_WRITE_DENIAL);
    }
    if (ctx.channel === "WHATSAPP") {
      return {
        status: "error",
        title: "Continue na plataforma",
        description: "Criar um fluxo pede uma revisão que não cabe aqui. Abra os Gatilhos Automáticos na plataforma e peça por lá.",
        internalUrl: "/gatilhos",
        openLabel: "Abrir Gatilhos Automáticos",
        appName: APP_NAME,
      };
    }

    const resolved = await resolveSingleTracking({ ctx, name: input.trackingName, field: "trackingName" });
    if ("failure" in resolved) return resolved.failure;
    const tracking = await findFlowTracking(resolved.tracking.id, ctx.organizationId);
    if (!tracking) return failure("Funil não encontrado", "Não achei esse funil na sua empresa.");
    const isParticipant = await prisma.trackingParticipant.findFirst({
      where: { trackingId: tracking.id, userId: ctx.userId },
      select: { id: true },
    });
    if (!isParticipant) return failure("Sem acesso ao funil", `Você não participa do funil ${tracking.name}.`);

    let blueprint = parseBlueprint(input.blueprintJson);
    if (!blueprint) {
      try {
        blueprint = await generateFlowBlueprint({ intent: input.flowRequest, provider: tracking.provider });
      } catch (generationError) {
        console.warn("[create-flow] geração falhou", generationError instanceof Error ? generationError.message : "erro");
        return failure("Não consegui montar o fluxo", "Tente descrever de novo, dizendo quando o fluxo começa e o que ele faz.");
      }
      if (blueprint.nodes.length === 0 || blueprint.nodes.length > MAX_FLOW_NODES) {
        return failure("Não consegui montar o fluxo", "O pedido ficou vago ou grande demais. Descreva um fluxo por vez.");
      }
      input.blueprintJson = JSON.stringify(blueprint);
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Criar fluxo de automação",
        description: describeProposal(blueprint, tracking.name, tracking.provider),
        appName: APP_NAME,
      };
    }

    const confirmedBlueprint = blueprint;
    const tagResult = await findOrCreateTags(prisma, ctx.organizationId, confirmedBlueprint.suggestedTags as TagRequest[]);
    const created = await prisma.$transaction((tx) =>
      createWorkflowFromBlueprint(tx, {
        trackingId: tracking.id,
        userId: ctx.userId,
        blueprint: confirmedBlueprint as unknown as Blueprint,
        agentMode: true,
        isActive: false,
        maxRunsPerHour: 60,
        tagMap: tagResult.tagMap,
      }),
    );

    const actor = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true, email: true, image: true } });
    await logActivity({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userName: actor?.name ?? "—",
      userEmail: actor?.email ?? "—",
      userImage: actor?.image,
      appSlug: "tracking",
      subAppSlug: "tracking-automacoes",
      featureKey: "astro.workflow.created",
      action: "workflow.created",
      actionLabel: `Criou pelo Astro o fluxo "${confirmedBlueprint.name}" em "${tracking.name}"`,
      resource: confirmedBlueprint.name,
      resourceId: created.workflowId,
      metadata: { via: "astro", nodes: created.nodesCreated, createdTags: tagResult.created.map((tag) => tag.name) },
    });

    const problemCount = predictBlueprintProblems(confirmedBlueprint, tracking.provider).length;
    return {
      status: "done",
      title: "Fluxo criado, desligado",
      description: [
        `"${confirmedBlueprint.name}" foi criado em ${tracking.name} com ${created.nodesCreated} passo(s).`,
        problemCount > 0 ? `${problemCount} ponto(s) aparecem em vermelho no editor até serem corrigidos.` : "",
        "Revise os passos e ligue o fluxo quando estiver pronto.",
      ]
        .filter(Boolean)
        .join("\n"),
      internalUrl: `/tracking/${tracking.id}/workflows/${created.workflowId}`,
      openLabel: "Abrir no editor",
      appName: APP_NAME,
    };
  },
};
