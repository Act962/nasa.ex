"use client";

/**
 * LiveKit client-side helpers.
 *
 * Wrapper minimalista pra conectar numa Room SFU, publicar tracks locais
 * e receber tracks remotas. O hook `use-sfu-room` consome essas funções
 * pra expor a fachada `RemotePeer` que os overlays do mundo consomem.
 *
 * Import dinâmico do `livekit-client` (lazy load) — evita inflar o bundle
 * inicial quando o user não está num World/SFU room.
 */

import type {
  Room,
  RemoteParticipant,
  RemoteTrackPublication,
  ConnectionState,
  RoomOptions,
} from "livekit-client";

const PUBLIC_LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL;

export function getPublicLiveKitUrl(): string {
  if (!PUBLIC_LIVEKIT_URL) {
    throw new Error(
      "[livekit:client] NEXT_PUBLIC_LIVEKIT_URL não configurado.",
    );
  }
  return PUBLIC_LIVEKIT_URL;
}

export interface ConnectRoomOptions {
  token: string;
  url?: string;
  roomOptions?: RoomOptions;
}

/**
 * Conecta numa Room. Retorna a Room já conectada.
 * Caller responsável por chamar `room.disconnect()` ao sair.
 */
export async function connectRoom({
  token,
  url,
  roomOptions,
}: ConnectRoomOptions): Promise<Room> {
  const { Room } = await import("livekit-client");
  const room = new Room(roomOptions);
  await room.connect(url ?? getPublicLiveKitUrl(), token);
  return room;
}

/**
 * Publica tracks de mic e/ou cam locais. Reusa MediaStream já capturada
 * (do hook mesh) — evita ter que pedir permissão de novo.
 */
export async function publishLocalTracks(
  room: Room,
  stream: MediaStream,
): Promise<void> {
  for (const track of stream.getTracks()) {
    if (track.kind === "audio") {
      await room.localParticipant.publishTrack(track, { source: "microphone" as never });
    } else if (track.kind === "video") {
      await room.localParticipant.publishTrack(track, { source: "camera" as never });
    }
  }
}

export type { Room, RemoteParticipant, RemoteTrackPublication, ConnectionState };
