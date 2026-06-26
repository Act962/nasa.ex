import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { pusherServer } from "@/lib/pusher";
import z from "zod";

/**
 * pokePeer — dispara um broadcast Pusher quando alguém "cutuca" outro user
 * via Cutucar (popover de avatar). Serve pra:
 *
 *   1. Mostrar pra TODOS no World um indicador 👋 acima do avatar do peer
 *      cutucado (a posição/identidade já é pública via presence channel).
 *   2. Mostrar um toast detalhado SOMENTE pro peer cutucado: "X te cutucou
 *      via Y. Preview: ..." — preview omitido pros outros pra preservar
 *      privacidade do conteúdo da mensagem/arquivo.
 *
 * NÃO persiste em banco — é efêmero/UX. A persistência da MENSAGEM em si
 * vai pelo pipeline normal (LeadMessage via tracking-chat) quando o chat
 * acontece. Aqui é só "ping visual".
 *
 * `action` informa o app usado pra cutucar (chat / nbox / forms / etc.)
 * `preview` é um snippet curto (até 80 chars) — só envia o texto se for
 * mensagem; outros tipos mandam label genérico ("enviou um arquivo").
 */
export const pokePeer = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/space-station/poke-peer",
    summary: "Broadcast a poke indicator above a peer's avatar in the World",
  })
  .input(
    z.object({
      stationId: z.string(),
      toUserId: z.string(),
      action: z.enum([
        "chat",
        "nbox",
        "forms",
        "agenda",
        "forge",
        "scripts",
        "file",
        "image",
      ]),
      preview: z.string().max(80).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { stationId, toUserId, action, preview } = input;
    const fromUserId = context.user.id;
    const fromName = context.user.name ?? "Alguém";

    if (toUserId === fromUserId) {
      throw errors.BAD_REQUEST({ message: "Não dá pra cutucar você mesmo" });
    }

    const channel = `presence-world-${stationId}`;
    await pusherServer
      .trigger(channel, "peer:poked", {
        fromUserId,
        fromName,
        toUserId,
        action,
        preview: preview ?? null,
        at: new Date().toISOString(),
      })
      .catch((pusherErr) => {
        console.error("[pokePeer] Pusher broadcast falhou:", pusherErr);
      });

    return { ok: true };
  });
