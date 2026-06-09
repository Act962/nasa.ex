import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { WhatsAppProvider } from "@/generated/prisma/enums";
import { canToggleInChatManual } from "@/features/tracking-chat/lib/can-toggle-in-chat-manual";
import { logActivity } from "@/features/admin/lib/activity-logger";
import {
  encryptMetaCredentialsInput,
  maskMetaCredentials,
  type MetaCredentialsInput,
} from "@/features/tracking-chat/lib/providers/meta-credentials";
import { clearMetaPhoneNumberIdLookupCache } from "@/features/tracking-chat/lib/get-cached-tracking-by-meta-phone-number-id";
import { invalidateOutboundProvider } from "@/features/tracking-chat/lib/providers/resolve-outbound-provider";
import z from "zod";

/**
 * Procedures de configuração de provider WhatsApp (Fase 4 — Roadmap
 * WhatsApp Oficial).
 *
 *  - **`getProviderSettings`**: devolve `{ provider, meta }` pra UI, com
 *    `meta` MASCARADO (`hasX` + `lastX`) — segredo em claro **nunca**
 *    sai do servidor.
 *  - **`setProviderSettings`**: atualiza `provider` e/ou credenciais Meta
 *    cifradas. Campos do `meta` em `undefined` ficam intactos; `null`
 *    limpa; string não-vazia cifra e grava. Usa a mesma regra de
 *    autoridade (`owner` / `admin` / `moderador`) do toggle In-Chat.
 *
 * A Fase 6 conectará o `provider` ao caminho de envio/recebimento via
 * factory por-tracking. Por ora, gravar `META_CLOUD` aqui **não** muda
 * comportamento — o chat Uazapi segue intocado. Isto é deliberado:
 * a Fase 4 abre o espaço pro cliente preparar a credencial antes da
 * Fase 5 (webhook oficial) entrar.
 */

const metaCredentialsSchema = z
  .object({
    accessToken: z.string().nullish(),
    phoneNumberId: z.string().nullish(),
    appSecret: z.string().nullish(),
    verifyToken: z.string().nullish(),
    businessAccountId: z.string().nullish(),
  })
  .partial();

export const getProviderSettings = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/integrations/provider-settings",
    summary: "Get WhatsApp provider + masked Meta credentials",
    tags: ["Integrations", "WhatsApp Provider"],
  })
  .input(
    z.object({
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { trackingId: input.trackingId },
      select: {
        id: true,
        organizationId: true,
        provider: true,
        metaAccessToken: true,
        metaPhoneNumberId: true,
        metaAppSecret: true,
        metaVerifyToken: true,
        metaBusinessAccountId: true,
      },
    });

    if (!instance) {
      return null;
    }

    if (instance.organizationId !== context.org.id) {
      throw errors.NOT_FOUND({ message: "Instância não encontrada" });
    }

    return {
      instanceId: instance.id,
      provider: instance.provider,
      meta: maskMetaCredentials({
        metaAccessToken: instance.metaAccessToken,
        metaPhoneNumberId: instance.metaPhoneNumberId,
        metaAppSecret: instance.metaAppSecret,
        metaVerifyToken: instance.metaVerifyToken,
        metaBusinessAccountId: instance.metaBusinessAccountId,
      }),
    };
  });

export const setProviderSettings = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/integrations/provider-settings",
    summary: "Update WhatsApp provider + (optionally) Meta credentials",
    tags: ["Integrations", "WhatsApp Provider"],
  })
  .input(
    z.object({
      trackingId: z.string(),
      provider: z.enum(["UAZAPI", "META_CLOUD"]).optional(),
      meta: metaCredentialsSchema.optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // ── Role check: mesma regra do toggle In-Chat. Member/Viewer fora ──
    const allowed = await canToggleInChatManual(
      context.user.id,
      context.org.id,
    );
    if (!allowed) {
      throw errors.FORBIDDEN({
        message:
          "Sem permissão pra alterar configuração de provider. Apenas owner, admin ou moderador.",
      });
    }

    const instance = await prisma.whatsAppInstance.findUnique({
      where: { trackingId: input.trackingId },
      select: {
        id: true,
        organizationId: true,
        provider: true,
        phoneNumber: true,
        metaAccessToken: true,
        metaPhoneNumberId: true,
        metaAppSecret: true,
        metaVerifyToken: true,
      },
    });

    if (!instance) {
      throw errors.NOT_FOUND({ message: "Instância não encontrada" });
    }
    if (instance.organizationId !== context.org.id) {
      throw errors.NOT_FOUND({ message: "Instância não encontrada" });
    }

    // ── Gate: trocar pra META_CLOUD exige credenciais completas ────────
    // Adicionado pós-Fase 5: o webhook oficial só funciona se as 4
    // credenciais obrigatórias (accessToken, phoneNumberId, appSecret,
    // verifyToken) estiverem gravadas. Sem o gate, admin trocaria
    // provider sem perceber que inbound silenciosamente para. O check
    // considera o estado *após* este update — se o payload está
    // completando credenciais faltantes, deixa passar.
    if (input.provider === "META_CLOUD") {
      const willHaveAccessToken =
        Boolean(input.meta?.accessToken) ||
        (input.meta?.accessToken !== null && Boolean(instance.metaAccessToken));
      const willHavePhoneNumberId =
        Boolean(input.meta?.phoneNumberId) ||
        (input.meta?.phoneNumberId !== null &&
          Boolean(instance.metaPhoneNumberId));
      const willHaveAppSecret =
        Boolean(input.meta?.appSecret) ||
        (input.meta?.appSecret !== null && Boolean(instance.metaAppSecret));
      const willHaveVerifyToken =
        Boolean(input.meta?.verifyToken) ||
        (input.meta?.verifyToken !== null && Boolean(instance.metaVerifyToken));

      const missing: string[] = [];
      if (!willHaveAccessToken) missing.push("accessToken");
      if (!willHavePhoneNumberId) missing.push("phoneNumberId");
      if (!willHaveAppSecret) missing.push("appSecret");
      if (!willHaveVerifyToken) missing.push("verifyToken");

      if (missing.length > 0) {
        throw errors.BAD_REQUEST({
          message: `Pra ativar Meta Cloud API é preciso preencher: ${missing.join(", ")}. O webhook oficial não funciona sem essas credenciais.`,
        });
      }
    }

    const updateData: {
      provider?: WhatsAppProvider;
      metaAccessToken?: string | null;
      metaPhoneNumberId?: string | null;
      metaAppSecret?: string | null;
      metaVerifyToken?: string | null;
      metaBusinessAccountId?: string | null;
    } = {};

    if (input.provider) {
      updateData.provider =
        input.provider === "META_CLOUD"
          ? WhatsAppProvider.META_CLOUD
          : WhatsAppProvider.UAZAPI;
    }

    if (input.meta) {
      const credentialsInput: MetaCredentialsInput = {
        accessToken: nullish(input.meta.accessToken),
        phoneNumberId: nullish(input.meta.phoneNumberId),
        appSecret: nullish(input.meta.appSecret),
        verifyToken: nullish(input.meta.verifyToken),
        businessAccountId: nullish(input.meta.businessAccountId),
      };
      Object.assign(updateData, encryptMetaCredentialsInput(credentialsInput));
    }

    if (Object.keys(updateData).length === 0) {
      // No-op: nem provider nem credenciais foram informados.
      return { changed: false, provider: instance.provider };
    }

    const updated = await prisma.whatsAppInstance.update({
      where: { id: instance.id },
      data: updateData,
      select: {
        id: true,
        provider: true,
        metaAccessToken: true,
        metaPhoneNumberId: true,
        metaAppSecret: true,
        metaVerifyToken: true,
        metaBusinessAccountId: true,
      },
    });

    // ── Invalida cache de lookup do webhook oficial ────────────────────
    // Se phone_number_id, provider ou credenciais cifradas mudaram, o
    // cache in-process em `get-cached-tracking-by-meta-phone-number-id`
    // pode estar apontando pra estado obsoleto. Como não temos a chave
    // antiga (cifrada com IV randômico), limpamos o cache inteiro — é
    // pequeno (algumas dezenas de entradas) e o evento é raro.
    const changedKeys = Object.keys(updateData);
    const touchedMetaCreds = changedKeys.some(
      (key) => key.startsWith("meta") || key === "provider",
    );
    if (touchedMetaCreds) {
      clearMetaPhoneNumberIdLookupCache();
      // Cache outbound da Fase 6 é por-tracking, então invalida só esta
      // entrada — não precisa nuke geral.
      invalidateOutboundProvider(input.trackingId);
    }

    // ── Audit log (sem segredos!) ──────────────────────────────────────
    logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      appSlug: "chat",
      subAppSlug: "whatsapp-provider",
      featureKey: "whatsapp_provider.settings_updated",
      action: "whatsapp_provider.settings_updated",
      actionLabel: `Provider WhatsApp atualizado (${updated.provider})`,
      resource: "whatsapp_instance",
      resourceId: instance.id,
      metadata: {
        provider: updated.provider,
        phoneNumber: instance.phoneNumber,
        changedFields: changedKeys,
      },
    }).catch(() => {});

    return {
      changed: true,
      provider: updated.provider,
      meta: maskMetaCredentials({
        metaAccessToken: updated.metaAccessToken,
        metaPhoneNumberId: updated.metaPhoneNumberId,
        metaAppSecret: updated.metaAppSecret,
        metaVerifyToken: updated.metaVerifyToken,
        metaBusinessAccountId: updated.metaBusinessAccountId,
      }),
    };
  });

/**
 * `z.string().nullish()` deixa passar `null`, `undefined` e string.
 * Convertemos pra `null | string | undefined` claro pro helper de
 * cifragem distinguir "limpar" de "não tocar".
 */
function nullish(value: string | null | undefined): string | null | undefined {
  return value;
}
