import "server-only";
import prisma from "@/lib/prisma";
import { validWhatsappPhone } from "@/http/uazapi/valid-whatsapp-phone";

/**
 * Resultado discriminado da validação de WhatsApp de um lead.
 *
 * - `skipped`: a validação não pôde rodar — comportamento **fail-open**, o
 *   fluxo de captação NÃO deve bloquear o lead (não perde lead por instância
 *   offline ou hiccup na uazapi). O `reason` explica por quê.
 * - `valid`: o número existe no WhatsApp.
 * - `invalid`: a instância respondeu e o número NÃO existe no WhatsApp →
 *   o caller deve bloquear o avanço.
 */
export type WhatsappValidationResult =
  | {
      status: "skipped";
      reason: "disabled" | "no_instance" | "instance_inactive" | "check_error";
    }
  | { status: "valid" }
  | { status: "invalid" };

/**
 * Valida, via a instância de WhatsApp do tracking vinculado ao formulário, se
 * o número digitado pelo lead é um WhatsApp válido.
 *
 * Cenários (todos fail-open, exceto `invalid`):
 *  1. Validação desligada nas settings (`validateWhatsapp !== true`) → skipped/disabled
 *  2. Form/tracking sem instância de WhatsApp → skipped/no_instance
 *  3. Instância existe mas está desconectada (`status !== "CONNECTED"`) —
 *     cobre "desativada" e "habilitou a validação mas a instância caiu
 *     depois" → skipped/instance_inactive
 *  4. Erro de rede/uazapi ao checar → skipped/check_error
 *  5. Instância OK + número não está no WhatsApp → invalid
 *  6. Instância OK + número está no WhatsApp → valid
 *
 * Não usamos `WhatsAppInstance.isActive` — esse campo não é manipulado no
 * banco (fica sempre `true`), então não reflete o estado real da instância.
 */
export async function validateLeadWhatsapp(
  formId: string,
  rawPhone: string,
): Promise<WhatsappValidationResult> {
  const form = await prisma.form.findUnique({
    where: { id: formId, published: true },
    select: {
      settings: { select: { validateWhatsapp: true, trackingId: true } },
    },
  });

  const settings = form?.settings;
  if (!settings?.validateWhatsapp) {
    return { status: "skipped", reason: "disabled" };
  }
  if (!settings.trackingId) {
    return { status: "skipped", reason: "no_instance" };
  }

  const instance = await prisma.whatsAppInstance.findUnique({
    where: { trackingId: settings.trackingId },
    select: { apiKey: true, baseUrl: true, status: true },
  });
  if (!instance) {
    return { status: "skipped", reason: "no_instance" };
  }
  if (instance.status !== "CONNECTED") {
    return { status: "skipped", reason: "instance_inactive" };
  }

  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) {
    return { status: "skipped", reason: "check_error" };
  }

  try {
    const [result] = await validWhatsappPhone({
      token: instance.apiKey,
      baseUrl: instance.baseUrl,
      data: { numbers: [digits] },
    });
    return result?.isInWhatsapp ? { status: "valid" } : { status: "invalid" };
  } catch (error) {
    console.warn("[form/validateLeadWhatsapp] check falhou", error);
    return { status: "skipped", reason: "check_error" };
  }
}
