import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { resend } from "@/lib/email/resend";
import { createNotification } from "@/lib/notification-service";
import { logActivity } from "@/lib/activity-logger";

/**
 * "Cobrar entrega" — usado quando uma ação está atrasada.
 * Notifica o(s) participante(s) por:
 *   • Email (resend) com link da ação
 *   • Notificação interna (in-app)
 *
 * Quem pode chamar: o criador da action OU owner/admin/moderador da org.
 */
export const requestActionDelivery = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      message: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const action = await prisma.action.findFirst({
      where: { id: input.actionId, organizationId: context.org.id },
      select: {
        id: true,
        title: true,
        dueDate: true,
        isDone: true,
        createdBy: true,
        workspaceId: true,
        workspace: { select: { id: true, name: true } },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });
    if (!action) throw new Error("Ação não encontrada");
    if (action.isDone) throw new Error("Esta ação já foi concluída.");

    // Permissão: criador OU owner/admin/moderador da org.
    const orgMember = (context.org.members as any[]).find(
      (m: any) => m.userId === context.user.id,
    );
    const isCreator = action.createdBy === context.user.id;
    const canRequest =
      isCreator ||
      (orgMember &&
        ["owner", "admin", "moderador"].includes(orgMember.role));
    if (!canRequest) {
      throw new Error(
        "Apenas o criador da ação ou um master/moderador podem cobrar a entrega.",
      );
    }

    // Recipientes: todos os participantes EXCETO quem está cobrando.
    const recipients = action.participants
      .map((p) => p.user)
      .filter((u) => u && u.id !== context.user.id);

    if (recipients.length === 0) {
      throw new Error(
        "Esta ação não tem participantes para cobrar a entrega.",
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://nasaex.com";
    const actionUrl = `${baseUrl}/workspaces/${action.workspaceId}?actionId=${action.id}`;

    const dueDateLabel = action.dueDate
      ? new Date(action.dueDate).toLocaleDateString("pt-BR")
      : "—";

    const senderName = context.user.name ?? "Um colega";
    const customMessage = input.message?.trim();

    // Dispara em paralelo: email + notificação interna pra cada participante.
    await Promise.allSettled(
      recipients.map(async (user) => {
        // 1. Notificação interna
        try {
          await createNotification({
            userId: user.id,
            organizationId: context.org.id,
            type: "CARD_EDIT",
            title: `Cobrança de entrega: "${action.title}"`,
            body: customMessage
              ? customMessage
              : `${senderName} pediu atualização sobre essa ação (vencida em ${dueDateLabel}).`,
            appKey: "workspace",
            actionUrl: `/workspaces/${action.workspaceId}?actionId=${action.id}`,
            metadata: {
              actionId: action.id,
              workspaceId: action.workspaceId,
              requestedBy: context.user.id,
            },
          });
        } catch (err) {
          console.error("[requestActionDelivery] notif fail:", err);
        }

        // 2. Email
        if (user.email) {
          try {
            await resend.emails.send({
              from: "Nasaex <noreply@notifications.nasaex.com>",
              to: user.email,
              subject: `Cobrança de entrega: "${action.title}"`,
              html: `
                <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
                  <h2 style="margin: 0 0 16px; color: #18181b;">⏰ Cobrança de entrega</h2>
                  <p style="color: #3f3f46; margin: 0 0 8px;">
                    <strong>${senderName}</strong> está cobrando a entrega da ação:
                  </p>
                  <div style="border-left: 4px solid #ef4444; background: #fef2f2; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
                    <div style="font-weight: 600; color: #991b1b;">${action.title}</div>
                    <div style="font-size: 13px; color: #7f1d1d; margin-top: 4px;">
                      Workspace: ${action.workspace?.name ?? "—"}<br/>
                      Vencimento: ${dueDateLabel}
                    </div>
                  </div>
                  ${
                    customMessage
                      ? `<p style="color: #3f3f46; margin: 16px 0; padding: 12px; background: #f4f4f5; border-radius: 4px;">"${customMessage}"</p>`
                      : ""
                  }
                  <a href="${actionUrl}" style="display: inline-block; background: #6d28d9; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 8px 0;">
                    Abrir a ação no NASA →
                  </a>
                  <p style="font-size: 12px; color: #71717a; margin-top: 24px;">
                    Você recebeu esse email porque é participante dessa ação no Nasaex.
                  </p>
                </div>
              `,
            });
          } catch (err) {
            console.error("[requestActionDelivery] email fail:", err);
          }
        }
      }),
    );

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "workspace",
      subAppSlug: "workspace-actions",
      featureKey: "workspace.action.delivery_requested",
      action: "workspace.action.delivery_requested",
      actionLabel: `Cobrou entrega de "${action.title}"`,
      resource: action.title,
      resourceId: action.id,
      metadata: {
        recipients: recipients.map((u) => u.id),
        message: customMessage ?? null,
      },
    });

    return {
      ok: true,
      notified: recipients.length,
    };
  });
