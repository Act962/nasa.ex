import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { getLiveKitUrl, isLiveKitConfigured, mintLiveKitToken } from "@/lib/livekit/server";

const TOKEN_TTL_SECONDS = 15 * 60;

/** Nome da sala do LiveKit da estação de uma empresa. Uma sala por empresa: o token só abre a da empresa ativa (RNF-2). */
export const orbitaRoomName = (organizationId: string) => `orbita:${organizationId}`;

/**
 * Token para entrar na sala de tempo real da estação (spec 0119, D-3). A permissão "Ver" é conferida pelo
 * `appRouterPermission` do router (o nome começa com "get"). Sem LiveKit configurado, devolve `null` e a estação
 * abre sem os colegas (CB-7).
 */
export const getJoinToken = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", path: "/orbita-station/join-token", summary: "Token da sala de tempo real da estação 3D" })
  .handler(async ({ context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.FORBIDDEN({ message: "Escolha uma empresa para entrar na estação." });
    if (!isLiveKitConfigured() || !(process.env.LIVEKIT_WS_URL ?? process.env.NEXT_PUBLIC_LIVEKIT_URL)) return null;

    const firstName = context.user.name.trim().split(/\s+/)[0] || "Colega";
    // "audience": só troca dados (posição, avatar). Áudio e vídeo não entram nesta etapa.
    const token = await mintLiveKitToken({
      roomName: orbitaRoomName(organizationId),
      identity: context.user.id,
      name: firstName,
      role: "audience",
      ttlSeconds: TOKEN_TTL_SECONDS,
    });
    return { token, url: getLiveKitUrl(), roomName: orbitaRoomName(organizationId) };
  });
