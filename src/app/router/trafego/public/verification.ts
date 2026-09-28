import { base } from "@/app/middlewares/base";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { clientIpFromHeaders, takeRateLimit } from "@/lib/rate-limit";
import {
  confirmTrafegoPhoneVerification,
  startTrafegoPhoneVerification,
} from "@/features/trafego/server/lib/phone-verification";
import { checkWhatsappNumber } from "@/features/trafego/server/lib/whatsapp-number-check";
import { lookupSocialProfile } from "@/features/trafego/server/lib/social-profile-lookup";

/**
 * Verificações do wizard público — sem auth, limitadas por IP. Nenhuma delas
 * grava na compra: o checkout lê a prova de verificação na hora de criar a
 * pending (`isTrafegoPhoneVerified`) e guarda os snapshots que o browser envia.
 */
const phoneSchema = z.string().trim().min(10).max(30);

function assertRateLimit(
  headers: Headers,
  scope: string,
  options: { max: number; windowMs: number },
) {
  const ip = clientIpFromHeaders(headers);
  const limit = takeRateLimit(scope, ip, options);
  if (!limit.allowed) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: `Muitas tentativas. Tente de novo em ${limit.retryAfterSeconds}s.`,
    });
  }
}

export const startTrafegoPhoneVerificationProcedure = base
  .route({ method: "POST", summary: "Envia código de verificação por WhatsApp" })
  .input(z.object({ phone: phoneSchema }))
  .handler(async ({ input, context }) => {
    assertRateLimit(context.headers, "trafego-otp-start", { max: 5, windowMs: 10 * 60_000 });
    return startTrafegoPhoneVerification(input.phone);
  });

export const confirmTrafegoPhoneVerificationProcedure = base
  .route({ method: "POST", summary: "Confirma o código de verificação" })
  .input(z.object({ phone: phoneSchema, code: z.string().regex(/^\d{6}$/) }))
  .handler(async ({ input, context }) => {
    assertRateLimit(context.headers, "trafego-otp-confirm", { max: 10, windowMs: 10 * 60_000 });
    return confirmTrafegoPhoneVerification(input.phone, input.code);
  });

export const checkTrafegoWhatsappNumberProcedure = base
  .route({ method: "POST", summary: "Confere se um número existe no WhatsApp" })
  .input(z.object({ phone: phoneSchema }))
  .handler(async ({ input, context }) => {
    assertRateLimit(context.headers, "trafego-number-check", { max: 10, windowMs: 10 * 60_000 });
    return checkWhatsappNumber(input.phone);
  });

export const lookupTrafegoSocialProfileProcedure = base
  .route({ method: "POST", summary: "Busca o perfil do Instagram/Facebook informado" })
  .input(z.object({ handle: z.string().trim().min(1).max(120) }))
  .handler(async ({ input, context }) => {
    assertRateLimit(context.headers, "trafego-social-lookup", { max: 15, windowMs: 10 * 60_000 });
    const profile = await lookupSocialProfile(input.handle);
    if (!profile) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Informe o @ do Instagram ou o link da página do Facebook.",
      });
    }
    return profile;
  });
