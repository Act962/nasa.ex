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
import { invalidateOutboundProvider } from "@/features/tracking-chat/lib/providers/resolve-outbound-provider";
import { createInstance } from "@/http/uazapi/admin/create-instance";
import { configureWebhook } from "@/http/uazapi/configure-webhook";
import { deleteInstance } from "@/http/uazapi/delete-instance";
import { disconnectInstance } from "@/http/uazapi/disconnect-instance";
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
        instanceName: true,
        profileName: true,
        instanceId: true,
        apiKey: true,
        baseUrl: true,
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

    // ── Gate: trocar pra META_CLOUD exige credenciais essenciais ───────
    // Pós-Fase 7: `appSecret` e `verifyToken` podem ser fornecidos pelo
    // env global (`META_APP_SECRET` / `META_VERIFY_TOKEN_GLOBAL`) — só
    // exigimos `accessToken` e `phoneNumberId` por instância. Se a env
    // global não estiver configurada, o webhook responde 401 com log
    // claro (não é silent failure). Instâncias Fase 4 que ainda tenham
    // appSecret/verifyToken próprios continuam tendo prioridade no
    // webhook (coluna > env).
    if (input.provider === "META_CLOUD") {
      const willHaveAccessToken =
        Boolean(input.meta?.accessToken) ||
        (input.meta?.accessToken !== null && Boolean(instance.metaAccessToken));
      const willHavePhoneNumberId =
        Boolean(input.meta?.phoneNumberId) ||
        (input.meta?.phoneNumberId !== null &&
          Boolean(instance.metaPhoneNumberId));

      const missing: string[] = [];
      if (!willHaveAccessToken) missing.push("accessToken");
      if (!willHavePhoneNumberId) missing.push("phoneNumberId");

      if (missing.length > 0) {
        throw errors.BAD_REQUEST({
          message: `Pra ativar Meta Cloud API é preciso preencher: ${missing.join(", ")}. (App Secret e Verify Token são opcionais — caem pro env global se vazios.)`,
        });
      }
    }

    const updateData: {
      provider?: WhatsAppProvider;
      apiKey?: string | null;
      baseUrl?: string | null;
      instanceId?: string | null;
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

    // ── Switch META_CLOUD → UAZAPI: provisão Uazapi sob demanda ───────
    // Quando o cliente vira o RadioGroup pra UAZAPI e a row não tem as
    // credenciais Uazapi (caso típico: instância nasceu com `provider=
    // META_CLOUD`, sem chamar a Uazapi no `create.ts`), provisionamos
    // aqui — chamando o admin `createInstance` + `configureWebhook` com
    // o `UAZAPI_TOKEN`. Idempotente: se já tem credenciais, reaproveita.
    //
    // Se a Uazapi falhar (rede, token admin inválido, quota), NÃO trocamos
    // o provider — devolvemos BAD_REQUEST com mensagem clara pro operador
    // tentar de novo. Isso evita o estado inconsistente onde
    // `provider=UAZAPI` mas a row segue sem `apiKey`/`baseUrl`/`instanceId`.
    if (
      input.provider === "UAZAPI" &&
      instance.provider !== WhatsAppProvider.UAZAPI &&
      (!instance.apiKey || !instance.baseUrl || !instance.instanceId)
    ) {
      try {
        const responseData = await createInstance({
          data: {
            name: instance.instanceName,
            systemName: instance.profileName ?? undefined,
          },
          token: process.env.UAZAPI_TOKEN!,
          baseUrl: process.env.NEXT_PUBLIC_UAZAPI_BASE_URL,
        });

        if (!responseData.response) {
          throw new Error("Uazapi não devolveu instância válida");
        }

        await configureWebhook({
          token: responseData.token,
          data: {
            url: `${process.env.NEXT_PUBLIC_APP_URL}/api/chat/webhook?trackingId=${input.trackingId}`,
            enabled: true,
            events: ["messages", "connection", "labels", "chat_labels"],
            action: "add",
            excludeMessages: ["wasSentByApi", "isGroupYes"],
          },
        });

        updateData.apiKey = responseData.token;
        updateData.baseUrl = process.env.NEXT_PUBLIC_UAZAPI_BASE_URL!;
        updateData.instanceId = responseData.instance.id;
      } catch (error) {
        console.error("[provider-settings] uazapi_provision_failed", {
          trackingId: input.trackingId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw errors.BAD_REQUEST({
          message:
            "Falha ao provisionar instância Uazapi. Tente novamente em alguns segundos ou contate o suporte.",
        });
      }
    }

    // ── Switch UAZAPI → META_CLOUD: tear-down Uazapi remoto ───────────
    // Snapshot das credenciais Uazapi ANTES do update — vamos zerar elas
    // no banco (linhas abaixo) e o tear-down remoto roda DEPOIS, com o
    // snapshot em mãos. Falha do tear-down não bloqueia o switch
    // (instância já pode ter sido removida fora do app, ou Uazapi tá
    // fora do ar) — é best-effort + log.
    const uazapiTearDown =
      input.provider === "META_CLOUD" &&
      instance.provider === WhatsAppProvider.UAZAPI &&
      instance.apiKey &&
      instance.baseUrl
        ? {
            apiKey: instance.apiKey,
            baseUrl: instance.baseUrl,
            instanceId: instance.instanceId,
          }
        : null;

    if (uazapiTearDown) {
      // Zera as credenciais locais junto com a troca de provider — assim
      // o cache outbound não tenta usar token revogado.
      updateData.apiKey = null;
      updateData.baseUrl = null;
      updateData.instanceId = null;
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

    // ── Tear-down Uazapi remoto (best-effort, pós-commit local) ───────
    // Disconnect + delete na Uazapi. Se falhar (já removida fora, Uazapi
    // down, token revogado), só logamos — o banco local já está coerente
    // (sem credenciais Uazapi) e a próxima provisão usa um token novo.
    if (uazapiTearDown) {
      try {
        await disconnectInstance(uazapiTearDown.apiKey, uazapiTearDown.baseUrl);
      } catch (error) {
        console.warn("[provider-settings] uazapi_disconnect_failed", {
          trackingId: input.trackingId,
          instanceId: uazapiTearDown.instanceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      try {
        await deleteInstance(uazapiTearDown.apiKey, uazapiTearDown.baseUrl);
      } catch (error) {
        console.warn("[provider-settings] uazapi_delete_failed", {
          trackingId: input.trackingId,
          instanceId: uazapiTearDown.instanceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Lookup do webhook oficial não tem mais cache — `metaPhoneNumberId`
    // virou plaintext indexado (`@unique`), resolvido em sub-ms via
    // `findUnique`. Mudanças aqui propagam imediatamente sem ação extra.

    const changedKeys = Object.keys(updateData);

    // Cache outbound da Fase 6 é por-tracking — invalida sempre que
    // provider ou QUALQUER credencial muda (inclui apiKey/baseUrl/
    // instanceId Uazapi mexidos pelo switch). Sem isso, send subsequente
    // pode pegar provider antigo do cache por até 30s.
    const touchedAnyCredential = changedKeys.some(
      (key) =>
        key === "provider" ||
        key === "apiKey" ||
        key === "baseUrl" ||
        key === "instanceId" ||
        key.startsWith("meta"),
    );
    if (touchedAnyCredential) {
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
