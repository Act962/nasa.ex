// Cópia interna do pedido "Comprar número": avisa a equipe pelo WhatsApp da organização da ÓRBITA.

import "server-only";
import { sendWhatsAppText } from "@/lib/whatsapp";

const DEFAULT_TEAM_NOTIFY_PHONE = "5586998221810";

/**
 * Envia a cópia pela instância conectada da org em `NUMBER_PURCHASE_NOTIFY_ORG_ID`.
 * Sem a variável (ou sem instância conectada) só registra no log: o pedido do cliente
 * já foi pelo WhatsApp dele, a cópia é best-effort.
 */
export async function notifyTeamAboutNumberPurchase(lead: { organizationName: string; userName: string; userEmail: string }) {
  const senderOrganizationId = process.env.NUMBER_PURCHASE_NOTIFY_ORG_ID;
  if (!senderOrganizationId) {
    console.warn("[campanhas/number-purchase] NUMBER_PURCHASE_NOTIFY_ORG_ID ausente — cópia não enviada", lead);
    return { isSent: false };
  }
  const teamPhone = process.env.NUMBER_PURCHASE_NOTIFY_PHONE?.replace(/\D/g, "") || DEFAULT_TEAM_NOTIFY_PHONE;
  const message = [
    "Opa Weydson, um novo lead gostaria de comprar um numero da Api Oficial do WhatsApp.",
    "",
    `Empresa: ${lead.organizationName}`,
    `Contato: ${lead.userName} (${lead.userEmail})`,
  ].join("\n");

  try {
    const result = await sendWhatsAppText({ organizationId: senderOrganizationId, phone: teamPhone, message });
    return { isSent: Boolean(result) };
  } catch (error) {
    console.error("[campanhas/number-purchase] falha ao enviar a cópia", error);
    return { isSent: false };
  }
}
