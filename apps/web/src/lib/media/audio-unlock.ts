"use client";

/**
 * Desbloqueio centralizado de autoplay de áudio do LiveKit.
 *
 * Por que existe:
 *   Navegadores (Chrome, Safari/iOS especialmente) bloqueiam reprodução de
 *   áudio antes da primeira interação do usuário. Quando a Room conecta sem
 *   gesto recente, os tracks remotos chegam, são anexados, mas não tocam —
 *   o usuário vê os participantes e não ouve ninguém. O LiveKit expõe:
 *     - `room.canPlaybackAudio` (boolean)
 *     - `room.startAudio()` (precisa ser chamado dentro de um user gesture)
 *     - `RoomEvent.AudioPlaybackStatusChanged`
 *
 *   Esta função registra UMA vez um listener global em `click/keydown/touchstart`
 *   que chama `room.startAudio()` e expõe um observable `subscribe()` pra UI
 *   mostrar/esconder o banner "Clique para ativar o áudio".
 *
 *   Reusado por /call/[room], pelo mundo (use-sfu-room) e por world-events.
 */

import type { Room } from "livekit-client";

export interface AudioUnlockState {
  /** Áudio está bloqueado pelo navegador e ainda não destravamos. */
  blocked: boolean;
  /** Tentativa de unlock falhou (ex: chrome flag, gesto inválido). */
  failed: boolean;
}

type Listener = (state: AudioUnlockState) => void;

/**
 * Monitora `room.canPlaybackAudio` e tenta destravar no primeiro gesto.
 * Retorna `dispose()` pra remover listeners ao desmontar.
 */
export function attachAudioUnlock(
  room: Room,
  onChange: Listener,
): () => void {
  let blocked = !room.canPlaybackAudio;
  let failed = false;
  let removed = false;

  const emit = () => onChange({ blocked, failed });

  // Estado inicial — emite síncrono pra UI já refletir.
  emit();

  const tryUnlock = async () => {
    if (removed) return;
    try {
      await room.startAudio();
      // O evento AudioPlaybackStatusChanged abaixo vai marcar blocked=false.
      // Se o startAudio() resolver mas o estado não mudar, é porque já estava
      // destravado — só atualizamos pra garantir.
      if (room.canPlaybackAudio) {
        blocked = false;
        failed = false;
        emit();
        detachGestureListeners();
      }
    } catch (err) {
      // Browser rejeitou — provavelmente o gesto não chegou ao topo da pilha
      // ainda. Mantemos os listeners pra próxima tentativa.
      failed = true;
      emit();
      console.warn("[audio-unlock] startAudio() rejeitado:", err);
    }
  };

  const onGesture = () => {
    void tryUnlock();
  };

  const attachGestureListeners = () => {
    document.addEventListener("click", onGesture, { capture: true });
    document.addEventListener("keydown", onGesture, { capture: true });
    document.addEventListener("touchstart", onGesture, {
      capture: true,
      passive: true,
    });
  };

  const detachGestureListeners = () => {
    document.removeEventListener("click", onGesture, { capture: true });
    document.removeEventListener("keydown", onGesture, { capture: true });
    document.removeEventListener("touchstart", onGesture, { capture: true });
  };

  if (blocked) attachGestureListeners();

  const onAudioStatus = () => {
    const next = !room.canPlaybackAudio;
    if (next === blocked) return;
    blocked = next;
    if (!blocked) {
      failed = false;
      detachGestureListeners();
    } else {
      attachGestureListeners();
    }
    emit();
  };

  // `AudioPlaybackStatusChanged` dispara quando o engine de áudio do LiveKit
  // muda de estado (ex: depois do startAudio bem-sucedido, ou se outro track
  // chegar com mídia bloqueada).
  room.on(
    // string literal pra evitar dependência hard do enum em compile time;
    // o livekit-client exporta `RoomEvent.AudioPlaybackStatusChanged` =
    // "audioPlaybackChanged".
    "audioPlaybackChanged" as never,
    onAudioStatus as never,
  );

  return () => {
    removed = true;
    detachGestureListeners();
    room.off("audioPlaybackChanged" as never, onAudioStatus as never);
  };
}
