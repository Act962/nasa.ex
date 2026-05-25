import { chargeStarsByAction } from "./charge-by-action";

/**
 * Cobrança centralizada de envio de mensagem outbound (WhatsApp via
 * uazapi, Instagram DM, Facebook Messenger).
 *
 * Reusado pelas 7 procedures de `app/router/message/create*.ts` pra
 * evitar duplicação de código (cobra, valida saldo, lança erro padrão).
 *
 * **Pricing**: padrão 1★ por mensagem (registry `message_send`). Admin
 * pode ajustar via UI em `/admin/stars > Regras`.
 *
 * Uso:
 * ```ts
 * await chargeMessageOutbound({
 *   organizationId: ctx.org.id,
 *   userId: ctx.user.id,
 *   channel: "whatsapp",
 * });
 * // se chegou aqui, débito OK — segue com sendText/sendMedia/etc
 * ```
 *
 * Lança ORPCError com `code: "INSUFFICIENT_STARS"` quando saldo
 * insuficiente. O caller já tem try/catch de erro padrão, então a
 * mensagem chega no frontend.
 */
import { ORPCError } from "@orpc/server";

export async function chargeMessageOutbound(opts: {
  organizationId: string;
  userId?: string;
  /** Canal pra granular o tracking no Insights (StarTransaction.appSlug). */
  channel: "whatsapp" | "instagram" | "facebook";
  /** Tipo de mídia — só pra description. */
  mediaType?: "text" | "image" | "audio" | "file" | "location" | "contact" | "buttons";
}): Promise<void> {
  const charge = await chargeStarsByAction(opts.organizationId, "message_send", {
    userId: opts.userId,
    appSlug: "message_send", // unifica todos os canais no breakdown
    description: `Mensagem outbound — ${opts.channel}${opts.mediaType ? ` (${opts.mediaType})` : ""}`,
  });

  if (!charge.success) {
    const balance =
      "newBalance" in charge ? charge.newBalance : 0;
    throw new ORPCError("BAD_REQUEST", {
      message: "Saldo de STARs insuficiente pra enviar mensagem.",
      data: {
        code: "INSUFFICIENT_STARS",
        balance,
        needed: "cost" in charge ? charge.cost : 1,
      },
    });
  }
}
