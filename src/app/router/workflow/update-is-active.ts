import { isTopicMenuName } from "@/features/tracking-chat-ai/lib/topic-menu";
import { PLACEHOLDER_PROBLEM, hasPlaceholderText } from "@/features/workflows/lib/placeholder-text";
import { AUTOMATION_DENIAL, checkWorkflowAccess } from "@/features/workflows/server/workflow-access";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { detectCollisions } from "@/features/workflows/lib/collision-detector";
import z from "zod";

function savedMenuIdsOf(nodeData: unknown): string[] {
  const payload = (nodeData as { action?: { payload?: { mode?: unknown; presetId?: unknown } } } | null)?.action?.payload;
  return payload?.mode === "preset" && typeof payload.presetId === "string" ? [payload.presetId] : [];
}

export const updateIsActive = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      workflowId: z.string(),
      isActive: z.boolean(),
      /** Quando true, ignora collision warnings (user confirmou conscientemente). */
      ignoreCollisions: z.boolean().optional(),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      isActive: z.boolean(),
      collisions: z
        .array(
          z.object({
            workflowId: z.string(),
            workflowName: z.string(),
            conflictType: z.string(),
            description: z.string(),
          }),
        )
        .optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const workflow = await prisma.workflow.findUnique({
      where: { id: input.workflowId },
      include: {
        nodes: { select: { type: true, data: true } },
        tracking: { select: { name: true, organizationId: true } },
      },
    });

    if (!workflow) {
      throw errors.NOT_FOUND({ message: "Workflow not found" });
    }

    // Ligar ou desligar exige ser da empresa do fluxo e ter a permissão de editar Automações
    // (spec 0090, S-2; spec 0092). Fluxo solto, sem funil nem workspace, só quem criou.
    const access = await checkWorkflowAccess(input.workflowId, context.user.id, "canEdit");
    if (access === "not-found") throw errors.NOT_FOUND({ message: "Workflow not found" });
    if (access === "forbidden") throw errors.FORBIDDEN({ message: AUTOMATION_DENIAL.canEdit });

    // Quando ATIVANDO em Modo Agente IA, checa colisão com outros workflows
    // ativos. Retorna warnings — front decide se mostra dialog de confirmação.
    if (
      input.isActive &&
      !input.ignoreCollisions &&
      workflow.agentMode &&
      workflow.tracking?.organizationId
    ) {
      const triggers = workflow.nodes
        .filter((n) =>
          [
            "NEW_LEAD",
            "LEAD_TAGGED",
            "MOVE_LEAD_STATUS",
            "AI_FINISHED",
            "FIRST_CHAT_INTERACTION",
            "FIRST_INTERACTION_OF_DAY",
            "LAST_INBOUND_TIMEOUT",
            "PAYMENT_RECEIVED",
            "MESSAGE_INCOMING",
            "WEBHOOK_EXTERNAL",
          ].includes(n.type),
        )
        .map((n) => ({
          type: n.type,
          data: n.data as Record<string, unknown> | null,
        }));

      const collisions = await detectCollisions({
        workflowId: workflow.id,
        organizationId: workflow.tracking.organizationId,
        trackingId: workflow.trackingId,
        triggers,
      });

      if (collisions.length > 0) {
        // Não bloqueia — devolve as colisões pro UI confirmar.
        return {
          id: workflow.id,
          isActive: workflow.isActive,
          collisions,
        };
      }
    }

    // Modelo de atendimento (spec 0097): com texto de exemplo no passo ou no menu que ele envia, o
    // fluxo não liga. A recusa é do servidor, para não depender do aviso da tela.
    const savedMenuIds = input.isActive ? workflow.nodes.flatMap((node) => savedMenuIdsOf(node.data)) : [];
    const savedMenus =
      savedMenuIds.length > 0
        ? await prisma.aiButtonPreset.findMany({
            where: { id: { in: savedMenuIds }, trackingId: workflow.trackingId ?? undefined },
            select: { id: true, name: true, bodyText: true, buttons: true, isActive: true },
          })
        : [];
    if (input.isActive && (workflow.nodes.some((node) => hasPlaceholderText(node.data)) || savedMenus.some((menu) => hasPlaceholderText([menu.bodyText, menu.buttons])))) {
      throw errors.BAD_REQUEST({ message: `${PLACEHOLDER_PROBLEM.title}: ${PLACEHOLDER_PROBLEM.message}` });
    }
    // O menu de perguntas que o fluxo envia liga junto: desligado, o passo de envio falharia.
    const topicMenuIdsToTurnOn = savedMenus.filter((menu) => !menu.isActive && isTopicMenuName(menu.name)).map((menu) => menu.id);

    const [updated] = await prisma.$transaction([
      prisma.workflow.update({
        where: { id: input.workflowId },
        data: { isActive: input.isActive },
      }),
      ...(topicMenuIdsToTurnOn.length > 0 ? [prisma.aiButtonPreset.updateMany({ where: { id: { in: topicMenuIdsToTurnOn } }, data: { isActive: true } })] : []),
    ]);

    // Ativou/desativou — invalida o cache do gatilho FIRST_INTERACTION_OF_DAY.
    if (workflow.trackingId) {
      const { invalidateReturningTriggerCache } = await import(
        "@/features/triggers/components/first-interaction-of-day/dispatch"
      );
      invalidateReturningTriggerCache(workflow.trackingId);
    }

    if (
      workflow.tracking?.organizationId &&
      workflow.isActive !== input.isActive
    ) {
      await logActivity({
        organizationId: workflow.tracking.organizationId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "tracking",
        action: input.isActive
          ? "workflow.activated"
          : "workflow.deactivated",
        actionLabel: input.isActive
          ? `Ativou a automação "${workflow.name}" no tracking "${workflow.tracking.name}"`
          : `Desativou a automação "${workflow.name}" no tracking "${workflow.tracking.name}"`,
        resource: workflow.name,
        resourceId: workflow.id,
        metadata: {
          trackingName: workflow.tracking.name,
          agentMode: workflow.agentMode,
        },
      });
    }

    return {
      id: updated.id,
      isActive: updated.isActive,
    };
  });
