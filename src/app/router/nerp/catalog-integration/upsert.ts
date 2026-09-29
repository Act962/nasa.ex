import { randomBytes } from "node:crypto";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireAppPermission } from "@/app/middlewares/app-permission";
import prisma from "@/lib/prisma";
import { decryptSecret, encryptSecret, last4 } from "@/lib/crypto";
import { getAccountInfo, upsertPaymentWebhook } from "@/lib/asaas";
import { toAsaasEnv } from "@/features/nerp-catalog/lib/integration-config";
import { buildAsaasWebhookUrl } from "@/features/nerp-catalog/lib/asaas-webhook-url";

const upsertInput = z.object({
  isActive: z.boolean(),
  ordersTrackingId: z.string().min(1, "Escolha o tracking que recebe os pedidos"),
  ordersStatusId: z.string().nullable(),
  logisticsTrackingId: z.string().min(1, "Escolha o tracking de logística"),
  logisticsStatusId: z.string().nullable(),
  whatsappNumber: z.string().nullable(),
  // Vazio = mantém a chave já salva.
  asaasApiKey: z.string().optional(),
  asaasEnv: z.enum(["production", "sandbox"]),
});

type TrackingCheck = "ok" | "invalid" | "no_status";

// Sem etapa escolhida, o pedido cai na primeira do funil: funil sem etapas recusaria todo pedido.
async function checkTrackingStatus(
  organizationId: string,
  trackingId: string,
  statusId: string | null,
): Promise<TrackingCheck> {
  const tracking = await prisma.tracking.findFirst({
    where: { id: trackingId, organizationId },
    select: { id: true, _count: { select: { status: true } } },
  });
  if (!tracking) return "invalid";
  if (tracking._count.status === 0) return "no_status";
  if (!statusId) return "ok";
  const status = await prisma.status.findFirst({
    where: { id: statusId, trackingId },
    select: { id: true },
  });
  return status ? "ok" : "invalid";
}

export const upsertNerpCatalogIntegration = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("catalogo-online", "canEdit"))
  .input(upsertInput)
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;

    const [ordersCheck, logisticsCheck] = await Promise.all([
      checkTrackingStatus(organizationId, input.ordersTrackingId, input.ordersStatusId),
      checkTrackingStatus(organizationId, input.logisticsTrackingId, input.logisticsStatusId),
    ]);
    if (ordersCheck === "invalid" || logisticsCheck === "invalid") {
      throw errors.BAD_REQUEST({ message: "Tracking ou etapa inválidos para esta organização." });
    }
    if (ordersCheck === "no_status" || logisticsCheck === "no_status") {
      const trackingLabel = ordersCheck === "no_status" ? "que recebe os pedidos" : "de logística";
      throw errors.BAD_REQUEST({
        message: `O tracking ${trackingLabel} não tem nenhuma etapa. Crie ao menos uma etapa (coluna) no funil antes de salvar.`,
      });
    }

    const existing = await prisma.nerpCatalogIntegration.findUnique({
      where: { organizationId },
    });
    const asaasEnv = toAsaasEnv(input.asaasEnv);
    const newApiKey = input.asaasApiKey?.trim() || null;
    const apiKey = newApiKey ?? (existing?.asaasApiKey ? decryptSecret(existing.asaasApiKey) : null);

    let accountEmail: string | null = null;
    if (apiKey) {
      try {
        const account = await getAccountInfo(apiKey, asaasEnv);
        accountEmail = account.email;
      } catch (error) {
        throw errors.BAD_REQUEST({
          message: `Chave Asaas recusada (${asaasEnv}): ${error instanceof Error ? error.message : "erro desconhecido"}`,
        });
      }
    }

    const webhookToken = existing?.asaasWebhookToken
      ? decryptSecret(existing.asaasWebhookToken)
      : randomBytes(24).toString("base64url");
    let webhookId = existing?.asaasWebhookId ?? null;
    let webhookWarning: string | null = null;
    if (apiKey) {
      try {
        const webhook = await upsertPaymentWebhook(apiKey, asaasEnv, {
          webhookId,
          name: "Órbita — Catálogo online",
          url: buildAsaasWebhookUrl(organizationId),
          email: accountEmail ?? context.user.email,
          authToken: webhookToken,
        });
        webhookId = webhook.id;
      } catch (error) {
        // Sem webhook o pagamento ainda é confirmado pela consulta periódica.
        webhookWarning = error instanceof Error ? error.message : "Falha ao criar webhook no Asaas";
      }
    }

    const data = {
      isActive: input.isActive,
      ordersTrackingId: input.ordersTrackingId,
      ordersStatusId: input.ordersStatusId,
      logisticsTrackingId: input.logisticsTrackingId,
      logisticsStatusId: input.logisticsStatusId,
      whatsappNumber: input.whatsappNumber?.replace(/\D/g, "") || null,
      asaasEnv,
      asaasWebhookId: webhookId,
      asaasWebhookToken: encryptSecret(webhookToken),
      ...(newApiKey
        ? { asaasApiKey: encryptSecret(newApiKey), asaasApiKeyLast4: last4(newApiKey) }
        : {}),
    };

    await prisma.nerpCatalogIntegration.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });

    return { saved: true, webhookWarning };
  });
