import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { resend } from "@/lib/email/resend";
import { reactAstroBotOtpEmail } from "@/lib/email/astro-bot-otp";
import { z } from "zod";

const OTP_EXPIRATION_MINUTES = 10;

/**
 * Inicia o fluxo de vínculo do WhatsApp do user com o Astro Bot.
 *
 * Pipeline:
 *   1. Valida phone E.164 + checa que a org tem botConfig ativo
 *   2. Checa max phones na org (config.maxPhonesPerOrg)
 *   3. Gera OTP de 6 dígitos, salva em `verification` com TTL 10min
 *   4. Envia email pro usuário (não pro phone — usa email já confirmado
 *      do Better Auth pra evitar phishing por SMS)
 *
 * Identifier do verification: `astro-bot-otp:<userId>:<phone>`.
 * Value: o OTP cleartext (verification é interno + TTL curto).
 */
export const startBindingOtp = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      phoneE164: z
        .string()
        .regex(/^\d{10,15}$/, "Phone formato E.164 sem '+' (ex: 5511999999999)"),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const config = await prisma.organizationBotConfig.findUnique({
      where: { organizationId: context.org.id },
      select: {
        id: true,
        isActive: true,
        maxPhonesPerOrg: true,
      },
    });
    if (!config) {
      throw errors.BAD_REQUEST({
        message:
          "Astro Bot WhatsApp não está configurado nesta org. Owner precisa configurar primeiro.",
      });
    }
    if (!config.isActive) {
      throw errors.BAD_REQUEST({
        message: "Astro Bot está inativo nesta org. Owner precisa ativar.",
      });
    }

    // Check max bindings na org
    const activeBindings = await prisma.userWhatsappBinding.count({
      where: { organizationId: context.org.id, isActive: true },
    });
    if (activeBindings >= config.maxPhonesPerOrg) {
      throw errors.BAD_REQUEST({
        message: `Org atingiu limite de ${config.maxPhonesPerOrg} bindings ativos. Owner pode aumentar em Configurações ou revogar um binding existente.`,
      });
    }

    // Phone já vinculado em qualquer org?
    const conflict = await prisma.userWhatsappBinding.findUnique({
      where: { phoneE164: input.phoneE164 },
      select: { id: true, userId: true, organizationId: true },
    });
    if (conflict) {
      const isMine =
        conflict.userId === context.user.id &&
        conflict.organizationId === context.org.id;
      throw errors.BAD_REQUEST({
        message: isMine
          ? "Esse phone já está vinculado nesta org. Revogue antes de vincular de novo."
          : "Esse phone já está vinculado em outra conta — não pode vincular em duas orgs simultaneamente.",
      });
    }

    // Gera OTP de 6 dígitos (banking-style)
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const identifier = `astro-bot-otp:${context.user.id}:${input.phoneE164}`;
    const expiresAt = new Date(
      Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000,
    );

    // Limpa OTPs anteriores desse mesmo (user, phone) — fluxo "esqueci, manda de novo"
    await prisma.verification.deleteMany({ where: { identifier } });
    await prisma.verification.create({
      data: { identifier, value: otp, expiresAt },
    });

    // Envia email pro user (não pro phone — phone ainda não foi validado)
    try {
      const sendResult = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "noreply@nasaagents.com",
        to: context.user.email,
        subject: `Código ${otp} pra vincular WhatsApp ao Astro`,
        react: reactAstroBotOtpEmail({
          userName: context.user.name ?? "",
          phoneE164: input.phoneE164,
          otp,
          expiresInMinutes: OTP_EXPIRATION_MINUTES,
        }),
      });
      if (sendResult.error) {
        throw new Error(sendResult.error.message ?? "resend_failed");
      }
    } catch (err) {
      console.error("[astro-bot/start-otp] email send failed", err);
      // Limpa OTP — sem email, não tem como user receber.
      await prisma.verification.deleteMany({ where: { identifier } });
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Não conseguimos enviar o código por email. Tente de novo.",
      });
    }

    return {
      ok: true,
      sentTo: context.user.email,
      expiresInMinutes: OTP_EXPIRATION_MINUTES,
    };
  });
