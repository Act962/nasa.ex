import "server-only";
import { AccessToken, TrackSource } from "livekit-server-sdk";

/**
 * LiveKit server-side helpers.
 *
 * Usado pra mint JWT tokens que o client consome em `livekit-client` pra
 * entrar numa sala SFU. Cada token carrega:
 *   - identity (userId)
 *   - name (display)
 *   - grants (room name + permissions)
 *   - ttl (validade do token; padrão 6h)
 *
 * Env vars obrigatórias em produção:
 *   LIVEKIT_API_KEY
 *   LIVEKIT_API_SECRET
 *   LIVEKIT_WS_URL          (ex: wss://your-app.livekit.cloud)
 *   NEXT_PUBLIC_LIVEKIT_URL (mesma URL, exposta ao client)
 *
 * Custo: LiveKit Cloud cobra ~US$ 0.0015/participant-min. Pra MVP de 200
 * pessoas × 2h/evento ≈ US$ 36/evento. Pra eventos maiores avaliar
 * self-host de mediasoup (Phase 2+).
 */

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;

export function isLiveKitConfigured(): boolean {
  return Boolean(API_KEY && API_SECRET);
}

export interface MintTokenInput {
  /** Sala alvo (ex: `event:<eventId>:stage` ou `event:<eventId>:booth-acme`). */
  roomName: string;
  /** Identificação única do user dentro da sala (use userId). */
  identity: string;
  /** Display name (opcional). */
  name?: string;
  /**
   * Tipo de participante:
   *   - speaker: pode publicar audio+video (palco).
   *   - audience: só recebe; não publica.
   *   - moderator: como speaker + pode kickar/mutar outros (admin).
   */
  role: "speaker" | "audience" | "moderator";
  /** TTL em segundos. Default 6h — caso o evento dure mais, regerar. */
  ttlSeconds?: number;
  /** Metadata arbitrário (ex: { stationId, userImage }). Visível pros outros peers. */
  metadata?: Record<string, unknown>;
}

export async function mintLiveKitToken(input: MintTokenInput): Promise<string> {
  if (!API_KEY || !API_SECRET) {
    throw new Error(
      "[livekit] LIVEKIT_API_KEY/SECRET não configurados — defina no .env.local antes de usar SFU rooms.",
    );
  }

  const ttl = input.ttlSeconds ?? 6 * 60 * 60; // 6h
  const at = new AccessToken(API_KEY, API_SECRET, {
    identity: input.identity,
    name: input.name,
    ttl,
    metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
  });

  // Permissions por role
  const canPublish = input.role === "speaker" || input.role === "moderator";
  const canSubscribe = true;
  const canPublishData = true; // chat in-room

  at.addGrant({
    roomJoin: true,
    room: input.roomName,
    canPublish,
    canSubscribe,
    canPublishData,
    // Source-level: speakers podem publicar mic+cam+screen; audience nada.
    // TrackSource é um enum do `@livekit/protocol` (re-exportado pelo sdk).
    canPublishSources: canPublish
      ? [TrackSource.MICROPHONE, TrackSource.CAMERA, TrackSource.SCREEN_SHARE]
      : [],
    // Moderator: bypass de admin no LiveKit (kick, mute outros).
    roomAdmin: input.role === "moderator",
  });

  return await at.toJwt();
}

/**
 * URL do WS que o client conecta. Exposta como NEXT_PUBLIC_ pra ficar
 * acessível em browser sem vazar API_KEY (que é só server-side).
 */
export function getLiveKitUrl(): string {
  const url = process.env.LIVEKIT_WS_URL ?? process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!url) {
    throw new Error(
      "[livekit] LIVEKIT_WS_URL não configurado — defina no .env.local.",
    );
  }
  return url;
}
