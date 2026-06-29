"use client";

/**
 * Reflete o ciclo de vida de uma Room LiveKit em estado React.
 *
 * O `livekit-client` já faz ICE-restart e reconexão automática internamente
 * — esta camada só expõe os sinais à UI (banner "reconectando…", erro
 * "desconectado", refresh de devices quando o user pluga/despluga hardware).
 *
 * Reusável por /call/[room], pelo mundo (use-sfu-room) e por world-events.
 */

import { useEffect, useState } from "react";
import type { Room, ConnectionState } from "livekit-client";

export type RoomConnectionUiState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface RoomResilienceState {
  state: RoomConnectionUiState;
  /** Última razão de disconnect, se houve. */
  disconnectReason?: string;
}

/**
 * Observa eventos de conexão da Room e devolve um estado discreto pra UI.
 * `null` é aceito enquanto a Room ainda não foi criada.
 */
export function useRoomResilience(
  room: Room | null,
): RoomResilienceState {
  const [state, setState] = useState<RoomResilienceState>({ state: "idle" });

  useEffect(() => {
    if (!room) {
      setState({ state: "idle" });
      return;
    }

    const map = (cs: ConnectionState): RoomConnectionUiState => {
      // ConnectionState do livekit-client é string enum:
      //   "disconnected" | "connecting" | "connected" | "reconnecting"
      switch (cs as string) {
        case "connected":
          return "connected";
        case "connecting":
          return "connecting";
        case "reconnecting":
          return "reconnecting";
        case "disconnected":
        default:
          return "disconnected";
      }
    };

    const apply = () =>
      setState({ state: map(room.state as ConnectionState) });

    apply();

    const onConnState = () => apply();
    const onReconnecting = () => setState({ state: "reconnecting" });
    const onReconnected = () => setState({ state: "connected" });
    const onDisconnected = (reason?: unknown) =>
      setState({
        state: "disconnected",
        disconnectReason: typeof reason === "string" ? reason : undefined,
      });

    room.on("connectionStateChanged" as never, onConnState as never);
    room.on("reconnecting" as never, onReconnecting as never);
    room.on("reconnected" as never, onReconnected as never);
    room.on("disconnected" as never, onDisconnected as never);

    return () => {
      room.off("connectionStateChanged" as never, onConnState as never);
      room.off("reconnecting" as never, onReconnecting as never);
      room.off("reconnected" as never, onReconnected as never);
      room.off("disconnected" as never, onDisconnected as never);
    };
  }, [room]);

  return state;
}

/**
 * Dispara `onChange()` toda vez que o conjunto de devices (mic/cam/saída) muda.
 * O LiveKit emite `MediaDevicesChanged` quando o user pluga/despluga hardware
 * ou troca permissão. A UI usa o gancho pra re-enumerar e oferecer o novo
 * device sem precisar de refresh manual.
 */
export function useMediaDevicesChange(
  room: Room | null,
  onChange: () => void,
): void {
  useEffect(() => {
    if (!room) return;
    const handler = () => onChange();
    room.on("mediaDevicesChanged" as never, handler as never);
    return () => {
      room.off("mediaDevicesChanged" as never, handler as never);
    };
  }, [room, onChange]);
}
