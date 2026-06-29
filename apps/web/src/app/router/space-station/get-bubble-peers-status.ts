import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Retorna o status de instância UAZAPI do usuário atual + dos peers informados.
 * Usado pela Bolha de Conversa do mundo para saber:
 * - Se EU posso enviar (tenho instância CONNECTED?)
 * - Se cada PEER pode receber (tem instância CONNECTED?)
 *
 * Convenção: "instância ativa" = primeira WhatsAppInstance com status=CONNECTED
 * de qualquer organização em que o usuário é Member (desempate: mais recente).
 */
export const getBubblePeersStatus = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/space-station/bubble-peers-status",
    summary: "Check WhatsApp instance status for me and peers in the bubble",
  })
  .input(z.object({ peerUserIds: z.array(z.string()).max(32) }))
  .handler(async ({ input, context }) => {
    const myUserId = context.user.id;
    const allUserIds = Array.from(new Set([myUserId, ...input.peerUserIds]));

    // Pega uma instância CONNECTED de qualquer org em que cada user é membro.
    // Retorna 1 instância por user (a mais recente).
    const instances = await prisma.whatsAppInstance.findMany({
      where: {
        status: "CONNECTED",
        organization: {
          members: { some: { userId: { in: allUserIds } } },
        },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        phoneNumber: true,
        profileName: true,
        profilePicUrl: true,
        trackingId: true,
        organizationId: true,
        organization: {
          select: {
            members: {
              where: { userId: { in: allUserIds } },
              select: { userId: true },
            },
          },
        },
      },
    });

    // Map userId → instância (primeira encontrada por ordem)
    const byUser = new Map<string, {
      id: string;
      phoneNumber: string | null;
      profileName: string | null;
      profilePicUrl: string | null;
      trackingId: string;
      organizationId: string;
    }>();

    for (const inst of instances) {
      for (const m of inst.organization.members) {
        if (!byUser.has(m.userId)) {
          byUser.set(m.userId, {
            id: inst.id,
            phoneNumber: inst.phoneNumber,
            profileName: inst.profileName,
            profilePicUrl: inst.profilePicUrl,
            trackingId: inst.trackingId,
            organizationId: inst.organizationId,
          });
        }
      }
    }

    const me = byUser.get(myUserId) ?? null;
    const peers = input.peerUserIds.map((uid) => {
      const inst = byUser.get(uid) ?? null;
      return {
        userId: uid,
        hasInstance: !!inst?.phoneNumber,
        phoneNumber: inst?.phoneNumber ?? null,
        profileName: inst?.profileName ?? null,
        profilePicUrl: inst?.profilePicUrl ?? null,
      };
    });

    return {
      me: me ? { hasInstance: !!me.phoneNumber, phoneNumber: me.phoneNumber, trackingId: me.trackingId } : { hasInstance: false, phoneNumber: null, trackingId: null },
      peers,
    };
  });
