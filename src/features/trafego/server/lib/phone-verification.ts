import "server-only";
import prisma from "@/lib/prisma";
import { normalizeWhatsappPhoneBr } from "@/features/trafego/lib/phone";
import { loadTrafegoSettings } from "./trafego-settings";
import { sendTrafegoClientWhatsapp } from "./send-client-whatsapp";

/**
 * Verificação do WhatsApp do cliente no wizard, por código de 6 dígitos.
 *
 * Reusa a tabela `verification` (better-auth) como o OTP do Astro Bot:
 *  - `trafego-phone-otp:<phone>`      → código, 10 min
 *  - `trafego-phone-verified:<phone>` → prova de que confirmou, 24 h
 *
 * Fail-open: se a instância não consegue enviar, o wizard segue sem
 * verificação e o card fica marcado como "não verificado" para a equipe.
 */
const OTP_TTL_MS = 10 * 60 * 1000;
const VERIFIED_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

const otpIdentifier = (phone: string) => `trafego-phone-otp:${phone}`;
const verifiedIdentifier = (phone: string) => `trafego-phone-verified:${phone}`;

export type StartPhoneVerificationResult =
  | { status: "sent"; phone: string; via: "template" | "text"; expiresInMinutes: number }
  | { status: "cooldown"; phone: string; retryInSeconds: number }
  | { status: "unavailable"; phone: string; reason: string }
  | { status: "invalid_phone" };

export async function startTrafegoPhoneVerification(
  rawPhone: string,
): Promise<StartPhoneVerificationResult> {
  const phone = normalizeWhatsappPhoneBr(rawPhone);
  if (!phone) return { status: "invalid_phone" };

  const identifier = otpIdentifier(phone);
  const latest = await prisma.verification.findFirst({
    where: { identifier },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return {
      status: "cooldown",
      phone,
      retryInSeconds: Math.ceil(
        (RESEND_COOLDOWN_MS - (Date.now() - latest.createdAt.getTime())) / 1000,
      ),
    };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const settings = await loadTrafegoSettings();

  const sent = await sendTrafegoClientWhatsapp({
    phone,
    text: `Seu código de verificação trafeGO é *${code}*. Vale por 10 minutos. Se não foi você, ignore esta mensagem.`,
    template: {
      name: settings.whatsappOtpTemplate,
      language: settings.whatsappTemplateLanguage,
      bodyParameters: [code],
    },
  });

  if (!sent.sent) {
    return { status: "unavailable", phone, reason: sent.reason };
  }

  await prisma.verification.deleteMany({ where: { identifier } });
  await prisma.verification.create({
    data: { identifier, value: code, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });

  return { status: "sent", phone, via: sent.via, expiresInMinutes: OTP_TTL_MS / 60_000 };
}

export type ConfirmPhoneVerificationResult =
  | { status: "verified"; phone: string }
  | { status: "invalid" | "expired" | "no_code" | "invalid_phone" };

export async function confirmTrafegoPhoneVerification(
  rawPhone: string,
  code: string,
): Promise<ConfirmPhoneVerificationResult> {
  const phone = normalizeWhatsappPhoneBr(rawPhone);
  if (!phone) return { status: "invalid_phone" };

  const identifier = otpIdentifier(phone);
  const pending = await prisma.verification.findFirst({
    where: { identifier },
    orderBy: { createdAt: "desc" },
  });
  if (!pending) return { status: "no_code" };
  if (pending.expiresAt.getTime() < Date.now()) {
    await prisma.verification.deleteMany({ where: { identifier } });
    return { status: "expired" };
  }
  if (pending.value !== code.trim()) return { status: "invalid" };

  await prisma.verification.deleteMany({ where: { identifier } });
  await prisma.verification.deleteMany({ where: { identifier: verifiedIdentifier(phone) } });
  await prisma.verification.create({
    data: {
      identifier: verifiedIdentifier(phone),
      value: "1",
      expiresAt: new Date(Date.now() + VERIFIED_TTL_MS),
    },
  });
  return { status: "verified", phone };
}

/** O checkout usa isto para carimbar `phoneVerifiedAt` na compra. */
export async function isTrafegoPhoneVerified(rawPhone: string | null | undefined): Promise<boolean> {
  const phone = normalizeWhatsappPhoneBr(rawPhone);
  if (!phone) return false;
  const proof = await prisma.verification.findFirst({
    where: { identifier: verifiedIdentifier(phone), expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  return Boolean(proof);
}
