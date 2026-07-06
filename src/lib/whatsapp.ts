import "server-only";

import prisma from "@/lib/prisma";
import { sendText } from "@/http/uazapi/send-text";

/**
 * Helper alto-nível pra disparar mensagem WhatsApp via uazapi.
 * Resolve `WhatsAppInstance` ativa da org e usa o token dela.
 *
 * Esse arquivo é wrapper — NÃO é nova integração. A infra de baixo
 * (`uazapi/send-text`, `WhatsAppInstance`) já existia e é usada pelas
 * funções Inngest de chat/forms. Aqui só facilita callsites de domínio
 * (NASA Payment dunning runner, etc) que precisam de "manda essa msg
 * pro telefone X na org Y" sem reescrever a resolução de instância.
 *
 * Retorna `null` se a org não tem instância CONNECTED — caller decide
 * se isso é erro (failed dunning) ou warning silencioso.
 */
export async function sendWhatsAppText(opts: {
  organizationId: string;
  phone: string; // E.164 ou só dígitos; uazapi normaliza
  message: string;
  /** Quando true, deixa o uazapi gerar link preview. Default false. */
  linkPreview?: boolean;
}): Promise<{ messageId: string | null } | null> {
  const instance = await prisma.whatsAppInstance.findFirst({
    where: {
      organizationId: opts.organizationId,
      status: "CONNECTED",
    },
    select: { apiKey: true, baseUrl: true, instanceName: true },
    orderBy: { createdAt: "asc" },
  });

  if (!instance || !instance.apiKey) {
    console.warn(
      `[sendWhatsAppText] no CONNECTED WhatsAppInstance for org ${opts.organizationId}`,
    );
    return null;
  }

  const response = await sendText(
    instance.apiKey,
    {
      number: opts.phone,
      text: opts.message,
      linkPreview: opts.linkPreview ?? false,
    },
    instance.baseUrl ?? undefined,
  );

  return {
    messageId: response?.messageid ?? null,
  };
}
