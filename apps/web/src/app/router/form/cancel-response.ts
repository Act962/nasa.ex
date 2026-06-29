import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { recordLeadEvent } from "@/features/leads/lib/history";

/**
 * "Cancelar formulário" do lead — DELETA a `FormResponses` por completo.
 *
 * Decisão de produto: cancelar volta o lead pro estado "ainda não preencheu
 * esse form" (no card do kanban o ícone do form some; na tela de Detalhes
 * o form vira "Preencher"). Por isso deletamos a row em vez de resetar
 * `jsonResponse` — ficar com row vazia (state="empty") deixaria o ícone
 * branco no card pra sempre, que não é o comportamento esperado.
 *
 * Permissão: APENAS Master (org role "owner") OU Tracking Owner
 * (TrackingParticipant.role = "OWNER") do tracking ATUAL do lead.
 * Roles "admin"/"member"/"moderador" da org NÃO podem (decisão de
 * produto: ação destrutiva).
 *
 * Registra:
 *   - `logActivity` → SystemActivityLog (vira card no painel Insights).
 *   - `recordLeadEvent({ NOTE })` → histórico do lead com flag
 *     `cancelled: true` no metadata (não polui a timeline de "form_submit").
 */
export const cancelResponse = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/forms/responses/:id/cancel",
    summary: "Reset a form response's fields (Owner/Master only)",
    tags: ["Forms"],
  })
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const userId = context.user.id;

      const existing = await prisma.formResponses.findFirst({
        where: { id: input.id },
        select: {
          id: true,
          leadId: true,
          formId: true,
          label: true,
          form: {
            select: {
              id: true,
              name: true,
              organizationId: true,
            },
          },
        },
      });

      if (!existing) {
        throw errors.NOT_FOUND({ message: "Resposta não encontrada" });
      }

      const orgId = existing.form.organizationId;

      // 1) Membership na org (defesa em profundidade — usuário precisa
      //    pertencer à mesma org do form).
      const member = await prisma.member.findFirst({
        where: { organizationId: orgId, userId },
        select: { role: true },
      });
      if (!member) {
        throw errors.UNAUTHORIZED({
          message: "Você não tem acesso a esta resposta",
        });
      }

      // 2) Permissão Master (org owner) ou Tracking Owner. Único par de
      //    roles autorizado a cancelar. "admin"/"member"/"moderador" não
      //    têm permissão pra essa ação destrutiva.
      const isMaster = member.role === "owner";

      let isTrackingOwner = false;
      if (!isMaster && existing.leadId) {
        const lead = await prisma.lead.findUnique({
          where: { id: existing.leadId },
          select: { trackingId: true },
        });
        if (lead?.trackingId) {
          const participant = await prisma.trackingParticipant.findFirst({
            where: {
              trackingId: lead.trackingId,
              userId,
              role: "OWNER",
            },
            select: { id: true },
          });
          isTrackingOwner = !!participant;
        }
      }

      if (!isMaster && !isTrackingOwner) {
        throw errors.FORBIDDEN({
          message:
            "Apenas o Master da conta ou o Owner do tracking podem cancelar formulários.",
        });
      }

      // 3) Delete: remove a row inteira. O server-side aggregator em
      //    `leads.get-many` só inclui forms que TÊM resposta, então o
      //    ícone do form some do card do kanban automaticamente após
      //    invalidação da query.
      await prisma.formResponses.delete({
        where: { id: existing.id },
      });
      const updated = {
        id: existing.id,
        formId: existing.formId,
        leadId: existing.leadId,
      };

      // 4) Activity log → aparece no painel Insights (Atividades).
      await logActivity({
        organizationId: orgId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "forms",
        subAppSlug: "forms-responses",
        featureKey: "forms.response.cancelled",
        action: "form_response_cancelled",
        actionLabel: `Cancelou a resposta do formulário "${existing.form.name}"`,
        resource: existing.form.name,
        resourceId: existing.id,
        metadata: {
          formId: existing.formId,
          leadId: existing.leadId,
          previousLabel: existing.label,
        },
      });

      // 5) Histórico do lead (não vira evento de "form_submit" — usamos
      //    NOTE com flag `cancelled` no metadata pra diferenciar).
      if (updated.leadId) {
        await recordLeadEvent({
          leadId: updated.leadId,
          eventType: "NOTE",
          userId,
          metadata: {
            cancelled: true,
            formId: existing.formId,
            formName: existing.form.name,
            formResponseId: updated.id,
            cancelledBy: userId,
          },
          notes: `Formulário "${existing.form.name}" cancelado (campos resetados).`,
        });
      }

      return {
        message: "Formulário cancelado com sucesso",
        response: updated,
      };
    } catch (err: any) {
      if (
        err?.code === "NOT_FOUND" ||
        err?.code === "BAD_REQUEST" ||
        err?.code === "UNAUTHORIZED" ||
        err?.code === "FORBIDDEN"
      ) {
        throw err;
      }
      console.error("[form/cancelResponse]", err);
      throw errors.INTERNAL_SERVER_ERROR({
        message: err?.message || "Erro interno",
      });
    }
  });
