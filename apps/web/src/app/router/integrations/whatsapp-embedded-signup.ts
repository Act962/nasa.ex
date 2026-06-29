import z from "zod";

import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { canToggleInChatManual } from "@/features/tracking-chat/lib/can-toggle-in-chat-manual";
import { logActivity } from "@/features/admin/lib/activity-logger";
import {
  onboardWhatsAppEmbeddedSignup,
  EmbeddedSignupConfigError,
  EmbeddedSignupInstanceMissingError,
  EmbeddedSignupPhoneMismatchError,
} from "@/features/integrations/lib/whatsapp-embedded-signup/onboard";
import { checkEmbeddedSignupRateLimit } from "@/features/integrations/lib/whatsapp-embedded-signup/logger";
import prisma from "@/lib/prisma";
import { WhatsAppProvider } from "@/generated/prisma/enums";
import { decryptStoredMetaCredentialsPartial } from "@/features/tracking-chat/lib/providers/meta-credentials";
import { getPhoneNumbers } from "@/http/whats-oficial";

/**
 * Procedure oRPC do Embedded Signup (Fase 7 — Roadmap WhatsApp Oficial).
 *
 * Recebe do frontend o `code` retornado pelo `FB.login` (TTL 30s) + os
 * IDs capturados via `postMessage WA_EMBEDDED_SIGNUP` e orquestra o
 * onboarding inteiro via `onboardWhatsAppEmbeddedSignup`. RBAC é o mesmo
 * de `setProviderSettings` (owner / admin / moderador).
 *
 * Nenhum segredo Meta vaza no audit log — só metadados (provider,
 * resultado, e os IDs públicos `waba_id` / `phone_number_id`).
 */

const completeEmbeddedSignupInput = z.object({
  trackingId: z.string(),
  code: z.string().min(1),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  /** `business_id` do postMessage — opcional, nem todo flow retorna. */
  businessId: z.string().min(1).optional(),
});

export const completeWhatsAppEmbeddedSignup = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/integrations/whatsapp-embedded-signup/complete",
    summary:
      "Complete WhatsApp Embedded Signup onboarding (Fase 7): exchange code + subscribe + register + persist.",
    tags: ["Integrations", "WhatsApp Provider", "Embedded Signup"],
  })
  .input(completeEmbeddedSignupInput)
  .handler(async ({ input, context, errors }) => {
    const allowed = await canToggleInChatManual(
      context.user.id,
      context.org.id,
    );
    if (!allowed) {
      throw errors.FORBIDDEN({
        message:
          "Sem permissão pra conectar Meta via Embedded Signup. Apenas owner, admin ou moderador.",
      });
    }

    // Rate limit defensivo: 3 onboardings/org/hora. Cobre click repetido
    // por instabilidade visual + ataque interno que invocaria a procedure
    // em loop pra esgotar quota da Graph API ou flood de PIN.
    const rateLimit = checkEmbeddedSignupRateLimit(context.org.id);
    if (!rateLimit.allowed) {
      const retryMinutes = Math.ceil(rateLimit.retryAfterMs / 60_000);
      throw errors.BAD_REQUEST({
        message: `Muitas tentativas de Embedded Signup. Tente novamente em ${retryMinutes} minuto(s).`,
        data: { code: "EMBEDDED_SIGNUP_RATE_LIMITED" },
      });
    }

    try {
      const result = await onboardWhatsAppEmbeddedSignup({
        trackingId: input.trackingId,
        code: input.code,
        wabaId: input.wabaId,
        phoneNumberId: input.phoneNumberId,
        businessId: input.businessId,
        organizationId: context.org.id,
      });

      // ── Audit (sem segredos!) ────────────────────────────────────────
      logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        appSlug: "chat",
        subAppSlug: "whatsapp-provider",
        featureKey: "whatsapp_provider.embedded_signup_completed",
        action: "whatsapp_provider.embedded_signup_completed",
        actionLabel: `WhatsApp Oficial conectado via Embedded Signup (${result.displayPhoneNumber ?? input.phoneNumberId})`,
        resource: "whatsapp_instance",
        resourceId: result.instanceId,
        metadata: {
          provider: result.provider,
          wabaId: input.wabaId,
          phoneNumberId: input.phoneNumberId,
          businessId: input.businessId,
          wabaName: result.wabaName,
          displayPhoneNumber: result.displayPhoneNumber,
          verifiedName: result.verifiedName,
        },
      }).catch(() => {});

      return {
        success: true,
        instanceId: result.instanceId,
        provider: result.provider,
        wabaName: result.wabaName,
        displayPhoneNumber: result.displayPhoneNumber,
        verifiedName: result.verifiedName,
      };
    } catch (error) {
      // Erros estruturados viram BAD_REQUEST com `code` semântico pro
      // frontend mostrar UI específica (configure envs / código expirou
      // / etc.). Erros inesperados (rede, Graph 5xx) sobem como
      // INTERNAL_SERVER_ERROR via re-throw.
      if (error instanceof EmbeddedSignupConfigError) {
        throw errors.BAD_REQUEST({
          message: error.message,
          data: { code: "EMBEDDED_SIGNUP_CONFIG_MISSING" },
        });
      }
      if (error instanceof EmbeddedSignupInstanceMissingError) {
        throw errors.BAD_REQUEST({
          message: error.message,
          data: { code: "EMBEDDED_SIGNUP_INSTANCE_MISSING" },
        });
      }
      if (error instanceof EmbeddedSignupPhoneMismatchError) {
        throw errors.BAD_REQUEST({
          message: error.message,
          data: { code: "EMBEDDED_SIGNUP_PHONE_MISMATCH" },
        });
      }
      throw error;
    }
  });

/**
 * Status do número Meta on-demand (Fase 7.5). Não cacheia — quando o
 * operador abre o card de configuração, queremos refletir o estado
 * REAL no momento (quality_rating muda com base no engagement, etc.).
 */
const getMetaPhoneStatusInput = z.object({
  trackingId: z.string(),
});

export const getMetaPhoneStatus = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/integrations/whatsapp-embedded-signup/phone-status",
    summary: "Lê status real do número Meta (display_phone_number, quality_rating, code_verification_status).",
    tags: ["Integrations", "WhatsApp Provider", "Embedded Signup"],
  })
  .input(getMetaPhoneStatusInput)
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

    if (!instance || instance.organizationId !== context.org.id) {
      throw errors.NOT_FOUND({ message: "Instância não encontrada" });
    }

    if (
      instance.provider !== WhatsAppProvider.META_CLOUD ||
      !instance.metaAccessToken ||
      !instance.metaPhoneNumberId ||
      !instance.metaBusinessAccountId
    ) {
      // Sem credenciais Meta completas (provider != META_CLOUD, ou
      // sem business_account_id). Devolve null pra UI esconder o card.
      return null;
    }

    let plain;
    try {
      plain = decryptStoredMetaCredentialsPartial({
        metaAccessToken: instance.metaAccessToken,
        metaPhoneNumberId: instance.metaPhoneNumberId,
        metaAppSecret: instance.metaAppSecret,
        metaVerifyToken: instance.metaVerifyToken,
        metaBusinessAccountId: instance.metaBusinessAccountId,
      });
    } catch {
      return null;
    }

    if (!plain.businessAccountId) return null;

    try {
      const phoneNumbers = await getPhoneNumbers({
        wabaId: plain.businessAccountId,
        accessToken: plain.accessToken,
      });
      const matched = phoneNumbers.data.find(
        (phone) => phone.id === plain!.phoneNumberId,
      );
      if (!matched) return null;
      return {
        phoneNumberId: matched.id,
        displayPhoneNumber: matched.display_phone_number,
        verifiedName: matched.verified_name,
        qualityRating: matched.quality_rating ?? null,
        codeVerificationStatus: matched.code_verification_status ?? null,
        messagingLimitTier: matched.messaging_limit_tier ?? null,
        platformType: matched.platform_type ?? null,
      };
    } catch (error) {
      // Erro da Graph (token expirado, WABA sumiu, etc.) — devolve null
      // pra UI esconder o card; log estruturado pra ops investigar.
      console.error("[whatsapp-embedded-signup:phone-status] graph_failed", {
        trackingId: input.trackingId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  });
