import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { NodeType } from "@/generated/prisma/enums";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { buildPickedAnswer, parsePickedAnswer } from "@/features/astro/lib/astro-picker";
import { ASTRO_WRITE_DENIAL } from "@/features/astro/lib/permission-denial";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { findFlowTracking } from "@/features/astro/server/tools/workflows/generate-flow";
import { planFlowEdit } from "@/features/astro/server/tools/workflows/plan-flow-edit";
import { executionNodes, triggerNodes } from "@/features/tracking-executions/lib/node-options";
import {
  DECIDE_LATER_ANSWER,
  applyFlowEditPlan,
  applyQuestionAnswer,
  flowEditPlanSchema,
  type FlowEditPlan,
  type FlowSnapshot,
} from "@/features/workflows/lib/flow-edit-plan";
import { collectFlowProblems } from "@/features/workflows/lib/flow-problems";
import { checkWorkflowAccess } from "@/features/workflows/server/workflow-access";
import type { AstroAction, AstroActionResult } from "../types";
import { cacheFlowEditPlan, flowEditPlanKey, readCachedFlowEditPlan } from "./flow-edit-cache";
import { buildQuestionCard } from "./flow-edit-questions";

// "Pedir ao ASTRO" dentro de um fluxo (spec 0094): a pessoa descreve a mudança, o Astro pergunta o
// que faltar com opções reais, mostra o que vai mudar e só grava depois do "sim". Ele nunca liga um
// fluxo, e não deixa um fluxo ligado com passo incompleto.

const APP_NAME = "Gatilhos Automáticos";
const MAX_FLOW_CHOICES = 12;
const WORKFLOW_PATH = /\/workflows\/([a-z0-9]{10,})/i;
const FLOW_REF_IN_TEXT = /\[ref:([a-z0-9]{10,})\]/i;
/** Cabeçalho que os campos "Pedir ao ASTRO" põem antes do pedido. */
const REQUEST_PREFIX = /^edite (este fluxo|um fluxo[^:]*):\s*/i;
const MIN_INFERRED_REQUEST_CHARS = 20;
const ANSWER_FIELDS = ["answer1", "answer2", "answer3"] as const;

export const IS_ASTRO_FLOW_EDIT_ON = process.env.NEXT_PUBLIC_ASTRO_FLOW_EDIT === "true";

const TRIGGER_TYPES = new Set(triggerNodes.map((option) => String(option.type)));
const INSERTABLE_TYPES = new Set(executionNodes.map((option) => String(option.type)).filter((stepType) => !TRIGGER_TYPES.has(stepType)));
const STEP_LABELS = new Map<string, string>();
for (const option of [...triggerNodes, ...executionNodes]) {
  if (!STEP_LABELS.has(String(option.type))) STEP_LABELS.set(String(option.type), option.label);
}
const labelOfStep = (stepType: string) => STEP_LABELS.get(stepType) ?? stepType;

const inputSchema = z.object({
  editRequest: z.string().trim().min(6).max(1500).describe("O que mudar no fluxo, nas palavras da pessoa: o que inserir, tirar ou trocar, e em que ponto."),
  workflowRef: z.string().optional(),
  answer1: z.string().optional(),
  answer2: z.string().optional(),
  answer3: z.string().optional(),
  activeFlowChoice: z.enum(["turn_off", "cancel"]).optional(),
  planJson: z.string().optional(),
  expectedUpdatedAt: z.string().optional(),
});

type EditFlowInput = z.infer<typeof inputSchema>;

function failure(title: string, description: string): AstroActionResult {
  return { status: "error", title, description, appName: APP_NAME };
}

function parsePlan(planJson: string | undefined): FlowEditPlan | null {
  if (!planJson) return null;
  try {
    const parsed = flowEditPlanSchema.safeParse(JSON.parse(planJson));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function askWhichFlow(ctx: AgentContext): Promise<AstroActionResult> {
  const workflows = await prisma.workflow.findMany({
    where: { agentMode: true, tracking: { organizationId: ctx.organizationId, ...(ctx.route?.trackingId ? { id: ctx.route.trackingId } : {}), participants: { some: { userId: ctx.userId } } } },
    select: { id: true, name: true },
    orderBy: { updatedAt: "desc" },
    take: MAX_FLOW_CHOICES,
  });
  if (workflows.length === 0) return failure("Nenhum fluxo para editar", "Não achei fluxos que você possa editar. Crie um primeiro em Gatilhos Automáticos.");
  return {
    status: "needs_input",
    title: "Qual fluxo?",
    description: "Em qual fluxo eu faço essa mudança?",
    missingFields: [{ key: "workflowRef", label: "o fluxo" }],
    appName: APP_NAME,
    picker: { kind: "select", options: workflows.map((workflow) => ({ label: workflow.name, answer: buildPickedAnswer(workflow.name, workflow.id) })) },
  };
}

async function loadFlow(workflowId: string, organizationId: string) {
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, tracking: { organizationId } },
    select: {
      id: true,
      name: true,
      isActive: true,
      agentMode: true,
      trackingId: true,
      updatedAt: true,
      nodes: { select: { id: true, type: true, name: true, position: true, data: true } },
      connections: { select: { id: true, fromNodeId: true, toNodeId: true, fromOutput: true } },
    },
  });
  if (!workflow?.trackingId) return null;
  const snapshot: FlowSnapshot = {
    steps: workflow.nodes
      .filter((node) => node.type !== "INITIAL")
      .map((node) => {
        const position = (node.position ?? {}) as { x?: unknown; y?: unknown };
        return { id: node.id, type: String(node.type), name: node.name, position: { x: Number(position.x) || 0, y: Number(position.y) || 0 }, data: (node.data ?? {}) as Record<string, unknown> };
      }),
    links: workflow.connections.map((connection) => ({ id: connection.id, fromNodeId: connection.fromNodeId, toNodeId: connection.toNodeId, fromOutput: connection.fromOutput })),
  };
  return { ...workflow, trackingId: workflow.trackingId, snapshot };
}

/** Grava o fluxo editado. Só banco dentro da transação (regra 18); o registro de atividade vem depois. */
async function saveEditedFlow(params: { workflowId: string; before: FlowSnapshot; after: FlowSnapshot; shouldTurnOff: boolean }): Promise<void> {
  const beforeById = new Map(params.before.steps.map((step) => [step.id, step]));
  const afterIds = new Set(params.after.steps.map((step) => step.id));
  const removedIds = params.before.steps.filter((step) => !afterIds.has(step.id)).map((step) => step.id);
  await prisma.$transaction(async (tx) => {
    await tx.connection.deleteMany({ where: { workflowId: params.workflowId } });
    if (removedIds.length > 0) await tx.node.deleteMany({ where: { workflowId: params.workflowId, id: { in: removedIds } } });
    for (const step of params.after.steps) {
      const previous = beforeById.get(step.id);
      if (!previous) {
        await tx.node.create({ data: { id: step.id, workflowId: params.workflowId, name: step.name, type: step.type as NodeType, position: step.position, data: step.data as never } });
      } else if (JSON.stringify(previous.data) !== JSON.stringify(step.data) || previous.position.x !== step.position.x || previous.position.y !== step.position.y) {
        await tx.node.update({ where: { id: step.id }, data: { position: step.position, data: step.data as never } });
      }
    }
    await tx.connection.createMany({
      data: params.after.links.map((link) => ({ id: link.id, workflowId: params.workflowId, fromNodeId: link.fromNodeId, toNodeId: link.toNodeId, fromOutput: link.fromOutput, toInput: "main" })),
      skipDuplicates: true,
    });
    // Também avança `updatedAt`, que é como outra edição em andamento percebe que o fluxo mudou.
    await tx.workflow.update({ where: { id: params.workflowId }, data: { updatedAt: new Date(), ...(params.shouldTurnOff ? { isActive: false } : {}) } });
  });
}

export const editFlowAction: AstroAction<typeof inputSchema> = {
  key: "workflow.edit_with_astro",
  app: "tracking",
  toolName: "edit_automation_flow",
  description:
    "Altera um FLUXO DE AUTOMAÇÃO que já existe: insere, remove ou troca um passo, ou religa uma saída, a partir do que a pessoa descreve. " +
    "Use para 'insira … nesse fluxo', 'adicione um passo de …', 'tire a espera', 'troque a mensagem de …', 'edite o fluxo …'. " +
    "Não é criar fluxo novo, nem ligar ou desligar fluxo.",
  permission: { appKey: "tracking", action: "edit" },
  requiresConfirmation: true,
  confirmTitle: "Alterar o fluxo",
  confirmWarnings: ["A mudança é gravada no fluxo salvo. Abra o editor para conferir.", "O Astro não liga fluxo: se ele estiver desligado, continua desligado."],
  input: inputSchema,
  // Só o código preenche: o fluxo vem da tela ou do seletor, as respostas vêm dos cartões e o plano confirmado é o plano mostrado.
  codeOnlyFields: ["workflowRef", "answer1", "answer2", "answer3", "activeFlowChoice", "planJson", "expectedUpdatedAt"],
  // O campo "Pedir ao ASTRO" do editor manda o fluxo aberto como referência no próprio texto.
  // Sem isto, a frase que já diz a mudança voltaria como pergunta "o que mudar?".
  inferFields: (text) => {
    const flowId = text.match(FLOW_REF_IN_TEXT)?.[1];
    const request = text.replace(FLOW_REF_IN_TEXT, "").replace(REQUEST_PREFIX, "").trim();
    return {
      ...(flowId ? { workflowRef: buildPickedAnswer("fluxo", flowId) } : {}),
      ...(request.length >= MIN_INFERRED_REQUEST_CHARS ? { editRequest: request } : {}),
    };
  },
  intentPatterns: [
    /\b(edite|editar|edita|altere|alterar|altera|mude|mudar|muda)\b.*\b(fluxo|gatilho|automacao)\b/,
    /\b(insira|inserir|insere|adicione|adicionar|adiciona|remova|remover|remove|tire|tirar|troque|trocar)\b.*\b(n?esse fluxo|n?este fluxo|no fluxo|do fluxo)\b/,
  ],
  fieldSteps: {
    editRequest: {
      title: "O que mudar no fluxo?",
      question: "Descreva a mudança: o que inserir, tirar ou trocar, e em que ponto.",
      picker: { kind: "text", placeholder: "Insira o envio da agenda depois das boas-vindas", maxLength: 1500 },
    },
  },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    if (!IS_ASTRO_FLOW_EDIT_ON) return failure("Ainda não disponível", "Editar fluxo pelo Astro ainda não está ligado nesta conta. Abra o fluxo no editor para alterar.");
    if (ctx.channel === "WHATSAPP") {
      return { status: "error", title: "Continue na plataforma", description: "Alterar um fluxo pede uma revisão que não cabe aqui. Abra o fluxo na plataforma e peça por lá.", internalUrl: "/gatilhos", openLabel: "Abrir Gatilhos Automáticos", appName: APP_NAME };
    }

    const workflowId = (input.workflowRef ? parsePickedAnswer(input.workflowRef).id : undefined) ?? ctx.route?.pathname?.match(WORKFLOW_PATH)?.[1];
    if (!workflowId) return askWhichFlow(ctx);

    const access = await checkWorkflowAccess(workflowId, ctx.userId, "canEdit");
    if (access === "forbidden") return failure("Sem permissão", ASTRO_WRITE_DENIAL);
    const workflow = access === "allowed" ? await loadFlow(workflowId, ctx.organizationId) : null;
    if (!workflow) return failure("Fluxo não encontrado", "Não achei esse fluxo na sua empresa.");
    if (!workflow.agentMode) return failure("Fluxo no formato antigo", "Este fluxo é do formato antigo e só pode ser alterado no editor.");
    const tracking = await findFlowTracking(workflow.trackingId, ctx.organizationId);
    if (!tracking) return failure("Funil não encontrado", "Não achei o funil deste fluxo na sua empresa.");

    const confirmedPlan = parsePlan(input.planJson);
    if (confirmedPlan && input.expectedUpdatedAt && input.expectedUpdatedAt !== workflow.updatedAt.toISOString()) {
      return failure("O fluxo mudou", "Alguém alterou este fluxo depois que eu montei a proposta. Peça a mudança de novo para eu partir da versão atual.");
    }

    let plan = confirmedPlan;
    if (!plan) {
      const planKey = flowEditPlanKey({ organizationId: ctx.organizationId, userId: ctx.userId, workflowId, workflowUpdatedAt: workflow.updatedAt, request: input.editRequest });
      let proposedPlan = readCachedFlowEditPlan(planKey);
      if (!proposedPlan) {
        try {
          proposedPlan = await planFlowEdit({ request: input.editRequest, flow: workflow.snapshot, flowName: workflow.name, provider: tracking.provider, organizationId: ctx.organizationId, userId: ctx.userId, trackingId: tracking.id });
        } catch (planError) {
          console.warn("[edit-flow] o plano de edição falhou", planError instanceof Error ? planError.message : "erro");
          return failure("Não consegui montar a mudança", "Tente descrever de novo, dizendo o que inserir, tirar ou trocar e em que ponto.");
        }
        cacheFlowEditPlan(planKey, proposedPlan);
      }
      if (proposedPlan.operations.length === 0) {
        return failure("Não consigo fazer essa mudança por aqui", proposedPlan.refusalReason ?? "Peça uma mudança por vez: inserir, tirar ou trocar um passo. Para refazer o fluxo, crie um novo.");
      }

      // Uma pergunta por vez. Só vale resposta que está entre as opções buscadas agora no banco.
      plan = proposedPlan;
      for (let questionIndex = 0; questionIndex < proposedPlan.questions.length; questionIndex += 1) {
        const answerField = ANSWER_FIELDS[questionIndex];
        const answer = input[answerField];
        const card = await buildQuestionCard({ plan: proposedPlan, questionIndex, organizationId: ctx.organizationId, trackingId: tracking.id, flow: workflow.snapshot, labelOfStep });
        const pickedId = answer ? parsePickedAnswer(answer).id : undefined;
        const isKnownOption = Boolean(pickedId && card.options.some((option) => option.id === pickedId));
        if (answer === DECIDE_LATER_ANSWER) {
          plan = applyQuestionAnswer(plan, questionIndex, "later");
        } else if (isKnownOption) {
          plan = applyQuestionAnswer(plan, questionIndex, { id: pickedId! });
        } else {
          return { status: "needs_input", title: card.title, description: card.description, missingFields: [{ key: answerField, label: card.title }], appName: APP_NAME, picker: card.picker };
        }
      }
    }

    const outcome = applyFlowEditPlan(workflow.snapshot, plan, { triggerTypes: TRIGGER_TYPES, insertableTypes: INSERTABLE_TYPES, labelOfType: labelOfStep, newId: createId });
    if (!outcome.ok) return failure("Não consegui montar a mudança", outcome.reason);

    const problems = collectFlowProblems(
      outcome.flow.steps.map((step) => ({ id: step.id, type: step.type, data: step.data })),
      outcome.flow.links.map((link) => ({ id: link.id, source: link.fromNodeId, target: link.toNodeId, sourceHandle: link.fromOutput })),
      tracking.provider,
    );
    const errors = problems.all.filter((problem) => problem.severity === "error");
    const warnings = problems.all.filter((problem) => problem.severity !== "error");

    // Fluxo ligado nunca fica com passo incompleto (RF-8): ou desliga junto, ou nada é gravado.
    if (workflow.isActive && errors.length > 0) {
      if (input.activeFlowChoice === "cancel") return failure("Cancelado", "Não alterei nada. O fluxo continua ligado como estava.");
      if (input.activeFlowChoice !== "turn_off") {
        return {
          status: "needs_input",
          title: "Este fluxo está ligado",
          description: `Com essa mudança ele ficaria com ${errors.length === 1 ? "um ponto em vermelho" : `${errors.length} pontos em vermelho`} (${errors[0].title.toLowerCase()}). Um fluxo ligado não pode ficar assim.`,
          missingFields: [{ key: "activeFlowChoice", label: "o que fazer com o fluxo ligado" }],
          appName: APP_NAME,
          picker: { kind: "select", options: [{ label: "Aplicar e desligar o fluxo", answer: "turn_off" }, { label: "Não alterar", answer: "cancel" }] },
        };
      }
    }
    const shouldTurnOff = workflow.isActive && errors.length > 0;

    if (dryRun) {
      // A confirmação guarda este mesmo objeto: o "sim" grava exatamente o que foi mostrado.
      (input as EditFlowInput).planJson = JSON.stringify({ ...plan, questions: [] });
      (input as EditFlowInput).expectedUpdatedAt = workflow.updatedAt.toISOString();
      (input as EditFlowInput).workflowRef = buildPickedAnswer(workflow.name, workflow.id);
      return {
        status: "done",
        title: "Alterar o fluxo",
        description: [
          `No fluxo "${workflow.name}", de ${tracking.name}, vou:`,
          ...outcome.summary.map((line) => `• ${line}`),
          shouldTurnOff ? "O fluxo será desligado junto, porque fica com ponto em vermelho." : workflow.isActive ? "O fluxo continua ligado." : "O fluxo continua desligado.",
          ...errors.map((problem) => `• Problema: ${problem.title}. ${problem.message}`),
          ...warnings.map((problem) => `• Atenção: ${problem.title}. ${problem.message}`),
        ].join("\n"),
        appName: APP_NAME,
      };
    }

    await saveEditedFlow({ workflowId: workflow.id, before: workflow.snapshot, after: outcome.flow, shouldTurnOff });
    const actor = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true, email: true, image: true } });
    await logActivity({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userName: actor?.name ?? "—",
      userEmail: actor?.email ?? "—",
      userImage: actor?.image,
      appSlug: "tracking",
      subAppSlug: "tracking-automacoes",
      featureKey: "astro.workflow.edited",
      action: "workflow.updated",
      actionLabel: `Alterou pelo Astro o fluxo "${workflow.name}" em "${tracking.name}"`,
      resource: workflow.name,
      resourceId: workflow.id,
      metadata: { via: "astro", changes: outcome.summary, turnedOff: shouldTurnOff },
    });

    return {
      status: "done",
      title: shouldTurnOff ? "Fluxo alterado e desligado" : "Fluxo alterado",
      description: [...outcome.summary, errors.length > 0 ? `${errors.length} ponto(s) aparecem em vermelho no editor até serem corrigidos.` : "", "Abra o editor para conferir a mudança."].filter(Boolean).join("\n"),
      internalUrl: `/tracking/${tracking.id}/workflows/${workflow.id}?astroEdit=${Date.now()}`,
      openLabel: "Ver no editor",
      appName: APP_NAME,
    };
  },
};
