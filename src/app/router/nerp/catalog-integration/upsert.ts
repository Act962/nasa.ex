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

async function assertStatusInTracking(
  organizationId: string,
  trackingId: string,
  statusId: string | null,
) {
  const tracking = await prisma.tracking.findFirst({
    where: { id: trackingId, organizationId },
    select: { id: true },
  });
  if (!tracking) return false;
  if (!statusId) return true;
  const status = await prisma.status.findFirst({
    where: { id: statusId, trackingId },
    select: { id: true },
  });
  return !!status;
}

export const upsertNerpCatalogIntegration = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("catalogo-online", "canEdit"))
  .input(upsertInput)
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;

    const [isOrdersValid, isLogisticsValid] = await Promise.all([
      assertStatusInTracking(organizationId, input.ordersTrackingId, input.ordersStatusId),
      assertStatusInTracking(organizationId, input.logisticsTrackingId, input.logisticsStatusId),
    ]);
    if (!isOrdersValid || !isLogisticsValid) {
      throw errors.BAD_REQUEST({ message: "Tracking ou etapa inválidos para esta organização." });
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
