import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { canToggleInChatManual } from "@/features/tracking-chat/lib/can-toggle-in-chat-manual";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { pusherServer } from "@/lib/pusher";
import z from "zod";

/**
 * Ativa/desativa o modo MANUAL do In-Chat para uma instância WhatsApp.
 *
 * Diferente do modo AUTO (`inChatModeActive`, controlado pelo cron + lazy
 * detection de falhas), o modo manual:
 *  - É ligado/desligado por owner/admin/moderador via UI em chat-settings
 *  - NÃO faz pular uazapi nas procedures de envio (atendente continua
 *    mandando pelo WhatsApp normalmente)
 *  - Apenas faz o banner azul "In-Chat ON" aparecer no /tracking-chat
 *    pra avisar o time que o canal alternativo está promovido
 *
 * A página pública /whatsapp/[slug] passou a ser sempre acessível
 * (só phone-auth como gate), então este toggle NÃO controla
 * visibilidade da página — só awareness do time.
 *
 * Permissão: defense in depth — checa role no middleware (`Member.role`).
 * Member/Viewer recebem FORBIDDEN.
 */
export const toggleInChatManual = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/integrations/toggle-in-chat-manual",
    summary: "Toggle In-Chat manual mode (owner/admin/moderador only)",
    tags: ["Integrations", "In-Chat"],
  })
  .input(
    z.object({
      instanceId: z.string(),
      enabled: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // ── Role check (server-side, defense in depth) ─────────────────────
    const allowed = await canToggleInChatManual(
      context.user.id,
      context.org.id,
    );
    if (!allowed) {
      throw errors.FORBIDDEN({
        message:
          "Sem permissão pra ativar/desativar o modo In-Chat. Apenas owner, admin ou moderador podem fazer isso.",
      });
    }

    // ── Confirma que a instância pertence à org do user ────────────────
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: input.instanceId },
      select: {
        id: true,
        organizationId: true,
        trackingId: true,
        phoneNumber: true,
        inChatModeManual: true,
        inChatModeActive: true,
      },
    });

    if (!instance) {
      throw errors.NOT_FOUND({ message: "Instância não encontrada" });
    }
    if (instance.organizationId !== context.org.id) {
      // Não vazamos info sobre instância de outra org — retorna mesmo erro
      // de "não encontrada".
      throw errors.NOT_FOUND({ message: "Instância não encontrada" });
    }

    // No-op idempotente — se já está no estado pedido, só retorna status
    if (instance.inChatModeManual === input.enabled) {
      return {
        active: instance.inChatModeActive || instance.inChatModeManual,
        source: deriveSource({
          auto: instance.inChatModeActive,
          manual: instance.inChatModeManual,
        }),
        manualEnabled: instance.inChatModeManual,
        changed: false,
      };
    }

    // ── Aplica o toggle ────────────────────────────────────────────────
    const updated = await prisma.whatsAppInstance.update({
      where: { id: instance.id },
      data: {
        inChatModeManual: input.enabled,
        inChatManualSetBy: input.enabled ? context.user.id : null,
        inChatManualSetAt: input.enabled ? new Date() : null,
      },
      select: {
        inChatModeManual: true,
        inChatModeActive: true,
      },
    });

    // ── Push pros clients invalidarem getInChatStatus em tempo real ────
    // Sem polling — banner+badge de TODOS atendentes na mesma trackingId
    // recebem o evento e atualizam.
    pusherServer
      .trigger(instance.trackingId, "inchat:status-changed", {})
      .catch((err) => {
        console.warn("[toggleInChatManual] pusher_broadcast_failed", err);
      });

    // ── Log de auditoria pro feed da org ───────────────────────────────
    logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      appSlug: "chat",
      subAppSlug: "in-chat",
      featureKey: input.enabled
        ? "in_chat.manual_activated"
        : "in_chat.manual_deactivated",
      action: input.enabled
        ? "in_chat.manual_activated"
        : "in_chat.manual_deactivated",
      actionLabel: input.enabled
        ? `In-Chat manual ATIVADO (${instance.phoneNumber ?? "?"})`
        : `In-Chat manual DESATIVADO (${instance.phoneNumber ?? "?"})`,
      resource: "whatsapp_instance",
      resourceId: instance.id,
      metadata: {
        phoneNumber: instance.phoneNumber,
        autoActive: instance.inChatModeActive,
      },
    }).catch(() => {});

    return {
      active: updated.inChatModeActive || updated.inChatModeManual,
      source: deriveSource({
        auto: updated.inChatModeActive,
        manual: updated.inChatModeManual,
      }),
      manualEnabled: updated.inChatModeManual,
      changed: true,
    };
  });

function deriveSource(params: {
  auto: boolean;
  manual: boolean;
}): "off" | "auto" | "manual" | "both" {
  if (params.auto && params.manual) return "both";
  if (params.auto) return "auto";
  if (params.manual) return "manual";
  return "off";
}
