import "server-only";
import prisma from "@/lib/prisma";
import { validWhatsappPhone } from "@/http/uazapi/valid-whatsapp-phone";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers/resolve-outbound-provider";
import { normalizeWhatsappPhoneBr } from "@/features/trafego/lib/phone";
import { loadTrafegoSettings } from "./trafego-settings";

/**
 * "Esse número existe no WhatsApp?" — via `/chat/check` da Uazapi, que é a
 * única API disponível para consultar um número de terceiros. A Meta Cloud
 * não expõe isso. `verifiedName` preenchido = conta Business com nome
 * verificado, que é o que um número na API Oficial mostra.
 *
 * Não prova que o número está na API Oficial — isso a equipe confere na
 * análise da conta. Fail-open: sem instância Uazapi, `skipped`.
 */
export type WhatsappNumberCheck =
  | {
      status: "found";
      phone: string;
      isBusiness: boolean;
      verifiedName: string | null;
      checkedAt: string;
    }
  | { status: "not_found"; phone: string; checkedAt: string }
  | { status: "skipped"; reason: string }
  | { status: "invalid_phone" };

async function resolveUazapiCredentials(): Promise<{ token: string; baseUrl?: string } | null> {
  const settings = await loadTrafegoSettings();

  if (settings.operationsTrackingId) {
    try {
      const resolved = await resolveOutboundProvider(settings.operationsTrackingId);
      if (resolved.providerId === "uazapi" && resolved.uazapiToken) {
        return { token: resolved.uazapiToken, baseUrl: resolved.uazapiBaseUrl };
      }
    } catch {
      // Sem instância no tracking de operação — tenta a org da agência.
    }
  }

  if (settings.agencyOrganizationId) {
    const instance = await prisma.whatsAppInstance.findFirst({
      where: {
        organizationId: settings.agencyOrganizationId,
        provider: "UAZAPI",
        status: "CONNECTED",
      },
      select: { apiKey: true, baseUrl: true },
      orderBy: { createdAt: "asc" },
    });
    if (instance?.apiKey) return { token: instance.apiKey, baseUrl: instance.baseUrl ?? undefined };
  }

  return null;
}

export async function checkWhatsappNumber(rawPhone: string): Promise<WhatsappNumberCheck> {
  const phone = normalizeWhatsappPhoneBr(rawPhone);
  if (!phone) return { status: "invalid_phone" };

  const credentials = await resolveUazapiCredentials();
  if (!credentials) return { status: "skipped", reason: "no_uazapi_instance" };

  try {
    const results = await validWhatsappPhone({
      token: credentials.token,
      baseUrl: credentials.baseUrl,
      data: { numbers: [phone] },
    });
    const result = results?.[0];
    const checkedAt = new Date().toISOString();
    if (!result || result.error) {
      return { status: "skipped", reason: result?.error ?? "empty_response" };
    }
    if (!result.isInWhatsapp) return { status: "not_found", phone, checkedAt };
    return {
      status: "found",
      phone,
      isBusiness: Boolean(result.verifiedName),
      verifiedName: result.verifiedName ?? null,
      checkedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[trafego/number-check] falhou para ${phone}: ${message}`);
    return { status: "skipped", reason: "check_error" };
  }
}

/** Instância Uazapi disponível para checar números? (para a landing decidir se mostra o botão) */
export async function isWhatsappNumberCheckAvailable(): Promise<boolean> {
  return Boolean(await resolveUazapiCredentials());
}
