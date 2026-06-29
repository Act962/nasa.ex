/**
 * Auth do Astro Bot via WhatsApp.
 *
 * Modelo híbrido (descrito em docs/astro-bot-whatsapp.md):
 *   1. Binding inicial: user vincula phone via OTP por email + define PIN
 *   2. 1º comando do dia: bot pede PIN → ativa sessão 8h
 *   3. Comando destrutivo: sempre pede PIN novo independente da sessão
 *   4. Auto-revoke: SIM swap (deviceId mudou) ou 3 PINs errados → lockout 1h
 *
 * Tools destrutivas precisam ser explicitamente listadas — qualquer comando
 * que invoque uma delas exige reauth com PIN.
 */
import "server-only";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
import type { UserWhatsappBinding } from "@/generated/prisma/client";

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8h
const MAX_PIN_FAILURES = 3;
const LOCKOUT_DURATION_MS = 60 * 60 * 1000; // 1h
const PIN_REGEX = /^\d{4,6}$/;

/**
 * Tools que SEMPRE exigem PIN, independente da sessão estar ativa.
 * Lista compatível com a convenção `<prefix>.<tool_name>` do orchestrator.
 *
 * Adicione aqui qualquer tool com efeito destrutivo/irreversível ou que
 * mexa em billing/permissões.
 */
const DESTRUCTIVE_TOOL_PREFIXES = [
  "mutations.delete_", // mutations.delete_lead, delete_tracking, etc
  "mutations.archive_", // archive_lead, etc
  "mutations.purge_",
  "mutations.merge_",
  "actions.delete_",
  "actions.archive_",
  "permissions.",
  "billing.",
];

export function isDestructiveTool(toolName: string): boolean {
  return DESTRUCTIVE_TOOL_PREFIXES.some((p) => toolName.startsWith(p));
}

export function isValidPin(pin: string): boolean {
  return PIN_REGEX.test(pin);
}

export async function hashPin(rawPin: string): Promise<string> {
  return bcrypt.hash(rawPin, 10);
}

export async function verifyPin(
  rawPin: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(rawPin, hash);
}

/**
 * Verifica se a sessão do binding está ativa AGORA (não expirou +
 * deviceId não mudou). Não revalida PIN — só checa janela.
 */
export function isSessionActive(binding: UserWhatsappBinding): boolean {
  if (!binding.sessionToken || !binding.sessionExpiresAt) return false;
  if (binding.sessionExpiresAt.getTime() < Date.now()) return false;
  return true;
}

export function isLocked(binding: UserWhatsappBinding): boolean {
  if (!binding.pinLockedUntil) return false;
  return binding.pinLockedUntil.getTime() > Date.now();
}

/**
 * Tenta autenticar com PIN. Em sucesso, cria sessão de 8h e zera failures.
 * Em fail, incrementa failures (3+ = lockout 1h).
 */
export async function tryAuthenticateWithPin(
  bindingId: string,
  rawPin: string,
  deviceId?: string,
): Promise<{
  ok: boolean;
  reason?: "invalid_pin_format" | "locked" | "wrong_pin" | "binding_inactive";
  binding?: UserWhatsappBinding;
}> {
  if (!isValidPin(rawPin)) {
    return { ok: false, reason: "invalid_pin_format" };
  }
  const binding = await prisma.userWhatsappBinding.findUnique({
    where: { id: bindingId },
  });
  if (!binding || !binding.isActive) {
    return { ok: false, reason: "binding_inactive" };
  }
  if (isLocked(binding)) {
    return { ok: false, reason: "locked", binding };
  }
  const valid = await verifyPin(rawPin, binding.pinHash);
  if (!valid) {
    const newFailures = binding.pinFailures + 1;
    const shouldLock = newFailures >= MAX_PIN_FAILURES;
    const updated = await prisma.userWhatsappBinding.update({
      where: { id: bindingId },
      data: {
        pinFailures: newFailures,
        pinLockedUntil: shouldLock
          ? new Date(Date.now() + LOCKOUT_DURATION_MS)
          : null,
      },
    });
    return { ok: false, reason: "wrong_pin", binding: updated };
  }
  // Sucesso — gera token de sessão e zera failures
  const sessionToken = randomBytes(32).toString("hex");
  const sessionExpiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const updated = await prisma.userWhatsappBinding.update({
    where: { id: bindingId },
    data: {
      pinFailures: 0,
      pinLockedUntil: null,
      sessionToken,
      sessionExpiresAt,
      sessionDeviceId: deviceId ?? null,
      lastSeenAt: new Date(),
    },
  });
  return { ok: true, binding: updated };
}

/** Revoga a sessão (logout). User precisa de PIN novo no próximo cmd. */
export async function revokeSession(bindingId: string): Promise<void> {
  await prisma.userWhatsappBinding.update({
    where: { id: bindingId },
    data: {
      sessionToken: null,
      sessionExpiresAt: null,
      sessionDeviceId: null,
    },
  });
}
