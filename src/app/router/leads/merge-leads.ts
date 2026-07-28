import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { LeadAction } from "@/generated/prisma/enums";
import { z } from "zod";
import { recordLeadHistory } from "./utils/history";
import { logActivity } from "@/features/admin/lib/activity-logger";
import {
  publishLeadDeleted,
  publishLeadChanged,
} from "@/features/leads/realtime/publish";

const fieldChoiceSchema = z.enum(["source", "target"]).optional();

const MERGE_LEAD_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  document: true,
  nickname: true,
  description: true,
  profile: true,
  amount: true,
  temperature: true,
  responsibleId: true,
  statusId: true,
  trackingId: true,
  tracking: { select: { organizationId: true } },
  conversation: { select: { id: true } },
} as const;

// Menor `order` = topo da coluna (board ordena por [statusId, order] asc).
async function computeTopOrder(
  tx: Prisma.TransactionClient,
  trackingId: string,
  statusId: string,
): Promise<Prisma.Decimal> {
  const top = await tx.lead.findFirst({
    where: { trackingId, statusId },
    orderBy: { order: "asc" },
    select: { order: true },
  });
  return top ? Prisma.Decimal.sub(top.order, 1000) : new Prisma.Decimal(1000);
}

export const mergeLeads = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", summary: "Mescla leads duplicados ao mover" })
  .input(
    z.object({
      merges: z
        .array(
          z.object({
            sourceLeadId: z.string(),
            targetLeadId: z.string(),
            targetStatusId: z.string(),
            choices: z
              .object({
                name: fieldChoiceSchema,
                email: fieldChoiceSchema,
                responsible: fieldChoiceSchema,
                temperature: fieldChoiceSchema,
              })
              .default({}),
          }),
        )
        .min(1),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    type SideEffect = {
      deleted: { leadId: string; trackingId: string; statusId: string };
      changed: {
        leadId: string;
        trackingId: string;
        statusId: string;
        fields: ("tag" | "temperature" | "responsible")[];
      };
      activity: {
        organizationId: string;
        sourceName: string;
        targetName: string;
        targetId: string;
      };
    };

    const sideEffects: SideEffect[] = [];

    for (const merge of input.merges) {
      const [source, target] = await Promise.all([
        prisma.lead.findUnique({
          where: { id: merge.sourceLeadId },
          select: MERGE_LEAD_SELECT,
        }),
        prisma.lead.findUnique({
          where: { id: merge.targetLeadId },
          select: MERGE_LEAD_SELECT,
        }),
      ]);

      if (!source || !target) throw errors.NOT_FOUND;
      if (source.id === target.id) {
        throw errors.BAD_REQUEST({
          message: "Origem e destino não podem ser o mesmo lead",
        });
      }
      const organizationId = target.tracking.organizationId;
      if (source.tracking.organizationId !== organizationId) {
        throw errors.FORBIDDEN;
      }

      // Permissão para consumir a origem — mesma trava do delete de lead.
      const [member, trackingParticipant] = await Promise.all([
        prisma.member.findFirst({
          where: { userId: context.user.id, organizationId },
          select: { role: true },
        }),
        prisma.trackingParticipant.findFirst({
          where: { userId: context.user.id, trackingId: source.trackingId },
          select: { role: true },
        }),
      ]);
      const isPrivileged =
        !!member && ["owner", "admin", "moderador"].includes(member.role);
      const isTrackingOwner = trackingParticipant?.role === "OWNER";
      if (!isPrivileged && !isTrackingOwner) {
        throw errors.FORBIDDEN({
          message: `Você não tem permissão para mesclar o lead "${source.name}".`,
        });
      }

      const sourceId = source.id;
      const targetId = target.id;

      await prisma.$transaction(async (tx) => {
        // ── Reatribui relações 1:N sem unique no leadId ────────────────
        const reassign = { where: { leadId: sourceId }, data: { leadId: targetId } };
        await tx.leadHistory.updateMany(reassign);
        await tx.leadJourneyEvent.updateMany(reassign);
        await tx.leadFile.updateMany(reassign);
        await tx.action.updateMany(reassign);
        await tx.appointment.updateMany(reassign);
        await tx.formResponses.updateMany(reassign);
        await tx.reminder.updateMany(reassign);
        await tx.clientOnboardingProcess.updateMany(reassign);
        await tx.linnkerScan.updateMany(reassign);
        await tx.paymentEntry.updateMany(reassign);
        await tx.broadcastRecipient.updateMany(reassign);
        // FK de ForgeProposal é `clientId`, não `leadId`.
        await tx.forgeProposal.updateMany({
          where: { clientId: sourceId },
          data: { clientId: targetId },
        });
        // Colunas soltas (sem relação Prisma) — não cascateiam sozinhas.
        await tx.aiChatRun.updateMany(reassign);
        await tx.workflowRun.updateMany(reassign);

        // ── Reatribui relações com unique no leadId: dedupe antes ──────
        const targetTagIds = (
          await tx.leadTag.findMany({
            where: { leadId: targetId },
            select: { tagId: true },
          })
        ).map((row) => row.tagId);
        if (targetTagIds.length) {
          await tx.leadTag.deleteMany({
            where: { leadId: sourceId, tagId: { in: targetTagIds } },
          });
        }
        await tx.leadTag.updateMany(reassign);

        const targetAgentIds = (
          await tx.leadAgentSession.findMany({
            where: { leadId: targetId },
            select: { agentId: true },
          })
        ).map((row) => row.agentId);
        if (targetAgentIds.length) {
          await tx.leadAgentSession.deleteMany({
            where: { leadId: sourceId, agentId: { in: targetAgentIds } },
          });
        }
        await tx.leadAgentSession.updateMany(reassign);

        const targetWorkflowIds = (
          await tx.leadDailyTriggerClaim.findMany({
            where: { leadId: targetId },
            select: { workflowId: true },
          })
        ).map((row) => row.workflowId);
        if (targetWorkflowIds.length) {
          await tx.leadDailyTriggerClaim.deleteMany({
            where: { leadId: sourceId, workflowId: { in: targetWorkflowIds } },
          });
        }
        await tx.leadDailyTriggerClaim.updateMany(reassign);

        // ── Conversa (1:1): mantém a do destino; só move a da origem se o
        //    destino não tiver nenhuma; senão a de origem cai no cascade.
        if (source.conversation && !target.conversation) {
          await tx.conversation.update({
            where: { id: source.conversation.id },
            data: { leadId: targetId, trackingId: target.trackingId },
          });
        }

        // ── Campos escalares no destino ────────────────────────────────
        const pickName =
          merge.choices.name === "source" ? source.name : target.name;
        const pickEmail =
          merge.choices.email === "source"
            ? source.email
            : (target.email ?? source.email);
        const pickResponsibleId =
          merge.choices.responsible === "source"
            ? source.responsibleId
            : (target.responsibleId ?? source.responsibleId);
        const pickTemperature =
          merge.choices.temperature === "source"
            ? source.temperature
            : target.temperature;

        const newOrder = await computeTopOrder(
          tx,
          target.trackingId,
          merge.targetStatusId,
        );
        const now = new Date();

        await tx.lead.update({
          where: { id: targetId },
          data: {
            name: pickName,
            email: pickEmail,
            responsibleId: pickResponsibleId,
            temperature: pickTemperature,
            amount: Prisma.Decimal.add(target.amount, source.amount),
            // Preenche lacunas do destino com dados da origem.
            document: target.document ?? source.document,
            nickname: target.nickname ?? source.nickname,
            description: target.description ?? source.description,
            profile: target.profile ?? source.profile,
            statusId: merge.targetStatusId,
            statusEnteredAt: now,
            lastStatusChangeAt: now,
            order: newOrder,
          },
        });

        await recordLeadHistory({
          leadId: targetId,
          userId: context.user.id,
          action: LeadAction.ACTIVE,
          notes: `Lead mesclado: "${source.name}" (${source.phone ?? "sem telefone"}) foi consolidado neste lead.`,
          tx,
        });

        // Consome a origem — o cascade limpa o que sobrou (conversa não movida,
        // etc.). Tudo que devia ser preservado já foi reatribuído acima.
        await tx.lead.delete({ where: { id: sourceId } });
      });

      sideEffects.push({
        deleted: {
          leadId: sourceId,
          trackingId: source.trackingId,
          statusId: source.statusId,
        },
        changed: {
          leadId: targetId,
          trackingId: target.trackingId,
          statusId: merge.targetStatusId,
          fields: ["tag", "temperature", "responsible"],
        },
        activity: {
          organizationId,
          sourceName: source.name,
          targetName: target.name,
          targetId,
        },
      });
    }

    // Efeitos fora da transação: realtime + activity log.
    for (const effect of sideEffects) {
      await publishLeadDeleted(effect.deleted);
      await publishLeadChanged(effect.changed);
      await logActivity({
        organizationId: effect.activity.organizationId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as { image?: string }).image,
        appSlug: "tracking",
        subAppSlug: "tracking-pipeline",
        featureKey: "lead.merged",
        action: "lead.merged",
        actionLabel: `Mesclou o lead "${effect.activity.sourceName}" em "${effect.activity.targetName}"`,
        resource: effect.activity.targetName,
        resourceId: effect.activity.targetId,
      });
    }

    return { merged: sideEffects.length };
  });
