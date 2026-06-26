import { randomUUID } from "node:crypto";
import { base } from "@/app/middlewares/base";
import { optionalAuthMiddleware } from "@/app/middlewares/auth";
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
 * Dois perfis de entrada (auth é OPCIONAL — `optionalAuthMiddleware`):
 *   - Logado: autorização completa (dono/membro/conexão/aprovado). Identity do
 *     LiveKit recebe um sufixo por aba (`${userId}:${sessionId}`) pra que duas
 *     abas do mesmo usuário NÃO colidam — sem isso o LiveKit derruba a conexão
 *     mais antiga ("kick-the-zombie") e gera o loop "funciona e some". O cliente
 *     remove o sufixo ao casar com a presença (Pusher), que segue por usuário.
 *   - Guest (sem sessão): só entra em station OPEN + pública. Identity é o
 *     `guestId` auto-atribuído pelo cliente (por aba), validado por formato pra
 *     não virar vetor de impersonação. Role `speaker` — guest fala no mundo.
 *
 * Role:
 *   - dono (USER) / membro da org dona (ORG) → "moderator" (admin do palco).
 *   - demais usuários com acesso → "speaker" (publica mic/cam).
 *   - guest → "speaker".
 */
export const joinWorld = base
  .use(optionalAuthMiddleware)
  .route({
    method: "POST",
    path: "/space-station/join-world",
    summary: "Obtém token SFU pra entrar no mundo da station",
  })
  .input(
    z.object({
      stationId: z.string().min(1),
      // Sufixo estável por aba (gerado no cliente, persistido em sessionStorage).
      // Torna a `identity` do LiveKit única por aba mesmo pro mesmo usuário.
      sessionId: z.string().min(1).max(64).optional(),
      // Identidade do convidado (sem sessão). Gerada e persistida por aba no
      // cliente (`_nasa_world_uid_*`). Regex força o prefixo `guest` pra um
      // convidado não conseguir mintar um token com a identity de outra pessoa.
      guestId: z
        .string()
        .regex(/^guest[a-zA-Z0-9_-]*$/)
        .max(64)
        .optional(),
      guestName: z.string().max(80).optional(),
    }),
  )
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

    const user = context.user; // pode ser null (convidado)
    const session = context.session; // pode ser null (convidado)
    const presenceChannel = `presence-world-${station.id}`;
    // `isLiveKitConfigured()` só checa API key/secret; sem a WS URL o cliente
    // não consegue conectar. Incluímos a URL aqui pra não reportar
    // sfuConfigured=true e mintar um token inútil (cliente cairia no mesh).
    const wsUrl =
      process.env.LIVEKIT_WS_URL ?? process.env.NEXT_PUBLIC_LIVEKIT_URL ?? null;
    const sfuConfigured = isLiveKitConfigured() && Boolean(wsUrl);
    const sfuRoom = sfuConfigured ? `station:${station.id}:world` : null;
    const sfuWsUrl = sfuConfigured ? wsUrl : null;

    // ── Caminho convidado (sem sessão) ───────────────────────────────────────
    if (!user) {
      // Convidado só entra em station OPEN e pública. Qualquer outro modo
      // (privada / MEMBERS_ONLY / REQUEST) exige login — espelha o gate
      // `checkStationAccess` pra não-donos.
      if (!station.isPublic || station.accessMode !== "OPEN") {
        throw errors.FORBIDDEN({
          message: "Entre na sua conta para acessar o mundo desta station.",
        });
      }
      // Sem `guestId` não dá pra casar o participante do LiveKit com o avatar da
      // presença (Pusher) — recusamos em vez de mintar um token órfão.
      if (!input.guestId) {
        throw errors.BAD_REQUEST({
          message: "Identificação de convidado ausente.",
        });
      }

      let guestToken: string | null = null;
      if (sfuConfigured && sfuRoom) {
        try {
          // Sufixo aleatório gerado no servidor. O `guestId` é client-controlled
          // e trafega em claro pela presença (Pusher), então é "adivinhável".
          // Sem o sufixo, um convidado mal-intencionado mintava um token com a
          // identity de outro convidado e o LiveKit derrubava a vítima (colisão
          // de identity → kick). Com o sufixo, cada mint é uma identity única e
          // não-colidível. O cliente remove o sufixo (`toAccountId`, no 1º `:`)
          // ao casar com a presença, então a chave por-usuário se mantém.
          // (Spoof do avatar via presence ainda é possível — hardening completo
          // exige identity de convidado emitida pelo servidor; ver follow-up.)
          const guestIdentity = `${input.guestId}:${randomUUID()}`;
          guestToken = await mintLiveKitToken({
            roomName: sfuRoom,
            identity: guestIdentity,
            name: input.guestName ?? "Convidado",
            role: "speaker",
            metadata: { stationId: station.id, guest: true },
          });
        } catch (err) {
          console.error(
            "[space-station/join-world] LiveKit mint (guest) falhou:",
            err,
          );
          throw err;
        }
      }

      return {
        stationId: station.id,
        sfuToken: guestToken,
        sfuRoom,
        sfuWsUrl,
        role: "speaker" as const,
        presenceChannel,
        sfuConfigured,
      };
    }

    // ── Caminho autenticado ──────────────────────────────────────────────────
    const userId = user.id;
    const activeOrgId = session?.activeOrganizationId ?? null;

    // ── Autorização (mesma lógica do checkStationAccess) ───────────────────
    const isUserOwner = station.type === "USER" && station.userId === userId;
    let isOrgMember = false;
    if (station.type === "ORG" && station.orgId) {
      const member = await prisma.member.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: station.orgId,
          },
        },
        select: { id: true },
      });
      isOrgMember = Boolean(member);
    }
    const isOwner = isUserOwner || isOrgMember;

    // Estação privada (isPublic=false) não é acessível a não-donos — espelha o
    // gate `checkStationAccess`, que só encontra a station com isPublic:true.
    // Sem isso, uma station oculta com accessMode OPEN entregaria token de
    // publicação a qualquer logado que soubesse o stationId.
    if (!isOwner && !station.isPublic) {
      throw errors.FORBIDDEN({
        message: "Você não tem acesso ao mundo desta station.",
      });
    }

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
        const accessRequest = await prisma.stationAccessRequest.findUnique({
          where: {
            stationId_userId: { stationId: station.id, userId },
          },
          select: { status: true },
        });
        if (accessRequest?.status === "APPROVED") allowed = true;
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
    let sfuToken: string | null = null;
    if (sfuConfigured && sfuRoom) {
      try {
        sfuToken = await mintLiveKitToken({
          roomName: sfuRoom,
          // Sufixo por aba — ver doc no topo. Sem `sessionId` cai pra `userId`
          // puro (compat: clientes antigos sem o campo).
          identity: input.sessionId ? `${userId}:${input.sessionId}` : userId,
          name: user.name ?? undefined,
          role,
          metadata: {
            stationId: station.id,
            activeOrgId: activeOrgId ?? undefined,
          },
        });
      } catch (err) {
        // Configurado mas o mint falhou (secret inválido, relógio, rede). Não
        // mascaramos como sucesso com token nulo (cair calado no mesh, sem
        // retry, esconde a misconfig) — relançamos pra que o react-query
        // tente de novo e o erro fique visível. Se persistir, o cliente cai no
        // mesh por sfuReady=false.
        console.error("[space-station/join-world] LiveKit mint falhou:", err);
        throw err;
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
