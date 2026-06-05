import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { mintLiveKitToken, isLiveKitConfigured } from "@/lib/livekit/server";
import z from "zod";

/**
 * Entrada do usuário no mundo persistente de uma Space Station.
 *
 * Espelha `world-events/redeem-ticket.ts`: valida acesso e devolve um token
 * LiveKit (SFU) pra sala default da station. Aqui não há ingresso — o acesso
 * vem do `accessMode` da station (mesma regra do `checkStationAccess`).
 *
 * Convidados anônimos (sem sessão) não chegam até aqui — o middleware exige
 * auth. Eles continuam vendo avatares pelo Pusher (presence), só não publicam
 * nem recebem mídia.
 *
 * Role:
 *   - dono (USER) / membro da org dona (ORG) → "moderator" (admin do palco).
 *   - demais usuários com acesso → "speaker" (publica mic/cam).
 */
export const joinWorld = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/space-station/join-world",
    summary: "Obtém token SFU pra entrar no mundo da station",
  })
  .input(z.object({ stationId: z.string().min(1) }))
  .output(
    z.object({
      stationId: z.string(),
      sfuToken: z.string().nullable(),
      sfuRoom: z.string().nullable(),
      sfuWsUrl: z.string().nullable(),
      role: z.enum(["speaker", "audience", "moderator"]),
      presenceChannel: z.string(),
      sfuConfigured: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const station = await prisma.spaceStation.findUnique({
      where: { id: input.stationId },
      select: {
        id: true,
        type: true,
        userId: true,
        orgId: true,
        accessMode: true,
        isPublic: true,
      },
    });
    if (!station) throw errors.NOT_FOUND({ message: "Station não encontrada." });

    const userId = context.user.id;
    const activeOrgId = context.session.activeOrganizationId ?? null;

    // ── Autorização (mesma lógica do checkStationAccess) ───────────────────
    const isUserOwner = station.type === "USER" && station.userId === userId;
    let isOrgMember = false;
    if (station.type === "ORG" && station.orgId) {
      const m = await prisma.member.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: station.orgId,
          },
        },
        select: { id: true },
      });
      isOrgMember = Boolean(m);
    }
    const isOwner = isUserOwner || isOrgMember;

    if (!isOwner && station.accessMode !== "OPEN") {
      // MEMBERS_ONLY / REQUEST: precisa ser membro/conectado/aprovado.
      let allowed = false;
      if (station.type === "USER" && station.userId) {
        const connection = await prisma.userConnection.findUnique({
          where: {
            userId_connectedId: {
              userId,
              connectedId: station.userId,
            },
          },
          select: { id: true },
        });
        if (connection) allowed = true;
      }
      if (!allowed && station.accessMode === "REQUEST") {
        const req = await prisma.stationAccessRequest.findUnique({
          where: {
            stationId_userId: { stationId: station.id, userId },
          },
          select: { status: true },
        });
        if (req?.status === "APPROVED") allowed = true;
      }
      if (!allowed) {
        throw errors.FORBIDDEN({
          message: "Você não tem acesso ao mundo desta station.",
        });
      }
    }

    // ── Role ────────────────────────────────────────────────────────────────
    const role: "speaker" | "audience" | "moderator" = isOwner
      ? "moderator"
      : "speaker";

    // ── Token SFU (LiveKit) ────────────────────────────────────────────────
    const presenceChannel = `presence-world-${station.id}`;
    const sfuConfigured = isLiveKitConfigured();
    let sfuToken: string | null = null;
    let sfuRoom: string | null = null;
    let sfuWsUrl: string | null = null;

    if (sfuConfigured) {
      sfuRoom = `station:${station.id}:world`;
      sfuWsUrl =
        process.env.LIVEKIT_WS_URL ?? process.env.NEXT_PUBLIC_LIVEKIT_URL ?? null;
      try {
        sfuToken = await mintLiveKitToken({
          roomName: sfuRoom,
          identity: userId,
          name: context.user.name ?? undefined,
          role,
          metadata: {
            stationId: station.id,
            activeOrgId: activeOrgId ?? undefined,
          },
        });
      } catch (err) {
        console.warn("[space-station/join-world] LiveKit mint falhou:", err);
      }
    }

    return {
      stationId: station.id,
      sfuToken,
      sfuRoom,
      sfuWsUrl,
      role,
      presenceChannel,
      sfuConfigured,
    };
  });
