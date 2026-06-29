import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import z from "zod";

/**
 * Envia uma mensagem no Chat Geral da Station — broadcast pra todos os
 * participantes do World via Pusher. Persiste em `StationMessage` pra que
 * users que entrem depois vejam o histórico.
 *
 * Isolado totalmente do chat 1:1 do Cutucar (que usa LeadMessage via
 * resolvePeerAsLead → WhatsApp). Mensagens daqui ficam só dentro do app.
 *
 * Validação de acesso: o user precisa ser o owner da Station OU member da
 * org que possui ela. Stations privadas só permitem members.
 */
export const sendStationMessage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/space-station/send-station-message",
    summary: "Broadcast a message to the Station's general chat",
  })
  .input(
    z.object({
      stationId: z.string(),
      body: z.string().min(1).max(2000),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { stationId, body } = input;
    const userId = context.user.id;

    const station = await prisma.spaceStation.findUnique({
      where: { id: stationId },
      select: {
        id: true,
        userId: true,
        orgId: true,
        isPublic: true,
      },
    });
    if (!station) throw errors.NOT_FOUND({ message: "Station não encontrada" });

    // Acesso: dono direto OU member da org. Stations privadas exigem isso;
    // públicas também — chat geral nunca é anônimo. Convidados não enviam.
    const isOwner =
      station.userId === userId ||
      station.orgId === context.session.activeOrganizationId;
    if (!isOwner) {
      // Pode ser member de outra org da station; checa membership.
      if (!station.orgId) {
        throw errors.FORBIDDEN({ message: "Sem permissão" });
      }
      const member = await prisma.member.findFirst({
        where: { userId, organizationId: station.orgId },
        select: { id: true },
      });
      if (!member) {
        throw errors.FORBIDDEN({ message: "Sem permissão pra enviar" });
      }
    }

    const message = await prisma.stationMessage.create({
      data: {
        stationId,
        senderId: userId,
        senderName: context.user.name ?? "Usuário",
        // `image` pode vir undefined em algumas sessions — normaliza pra null.
        senderImage: (context.user as { image?: string | null }).image ?? null,
        body,
      },
    });

    // Broadcast no MESMO channel da presença do World — evita criar nova
    // conexão Pusher só pra chat. O hook `useStationChat` ouve esse evento.
    const channel = `presence-world-${stationId}`;
    await pusherServer
      .trigger(channel, "station:message", {
        id: message.id,
        senderId: message.senderId,
        senderName: message.senderName,
        senderImage: message.senderImage,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      })
      .catch(() => {
        // Best-effort: se Pusher falhar, mensagem ainda persistiu no banco.
        // Clientes vão pegar no próximo refetch da `listStationMessages`.
      });

    return {
      id: message.id,
      senderId: message.senderId,
      senderName: message.senderName,
      senderImage: message.senderImage,
      body: message.body,
      createdAt: message.createdAt,
    };
  });
