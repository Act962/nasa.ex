"use client";

/**
 * Coordenador de unlock de autoplay para os <audio> remotos renderizados à mão
 * pelo mundo (video-overlay.tsx).
 *
 * Por que existe (o bug que ele corrige):
 *   O mundo toca o áudio remoto por elementos <audio srcObject> PRÓPRIOS, e NÃO
 *   via `track.attach()` do LiveKit. Então `room.canPlaybackAudio` /
 *   `room.startAudio()` (usados pelo `audio-unlock.ts`) não refletem nem
 *   controlam esses elementos. Em produção (política de autoplay estrita do
 *   navegador), o `play()` desses <audio> é barrado, mas o LiveKit reporta
 *   "ok" → `audioBlocked` ficava `false`, o banner "ativar áudio" nunca
 *   aparecia, e o usuário ficava mudo sem aviso (e sem forma clara de
 *   destravar). Isso dava o "ora ninguém escuta, ora um sim outro não".
 *
 *   Este módulo registra os <audio> REAIS, detecta o bloqueio pelo resultado do
 *   próprio `play()` deles, e destrava TODOS de uma vez no primeiro gesto do
 *   usuário. Funciona igual para SFU e mesh (ambos usam o mesmo overlay).
 */

import { useEffect, useState } from "react";

type Listener = (blocked: boolean) => void;

const elements = new Set<HTMLAudioElement>();
// Elementos cujo último play() foi REJEITADO (autoplay barrado). Base da
// detecção — mais confiável que `el.paused`, que oscila durante o play().
const failed = new WeakSet<HTMLAudioElement>();
const listeners = new Set<Listener>();
let blocked = false;
let gestureAttached = false;

function notify() {
  for (const l of listeners) l(blocked);
}

function setBlocked(next: boolean) {
  if (next === blocked) return;
  blocked = next;
  notify();
}

/** `blocked` = existe algum elemento registrado cujo play() foi rejeitado. */
function recompute() {
  let anyBlocked = false;
  for (const el of elements) {
    if (failed.has(el)) {
      anyBlocked = true;
      break;
    }
  }
  setBlocked(anyBlocked);
}

function markPlay(el: HTMLAudioElement, ok: boolean) {
  if (ok) failed.delete(el);
  else failed.add(el);
  recompute();
}

/** Tenta tocar um elemento; em falha (autoplay), marca como bloqueado. */
export function tryPlayRemoteAudio(el: HTMLAudioElement) {
  el.play()
    .then(() => markPlay(el, true))
    .catch(() => markPlay(el, false));
}

function onGesture() {
  // No primeiro gesto válido, tenta tocar todos os elementos pendentes.
  void unlockAudioNow();
}

function attachGesture() {
  if (gestureAttached || typeof document === "undefined") return;
  gestureAttached = true;
  // Capture=true pra pegar o gesto antes que o canvas do Phaser o consuma.
  document.addEventListener("pointerdown", onGesture, { capture: true });
  document.addEventListener("keydown", onGesture, { capture: true });
  document.addEventListener("touchstart", onGesture, {
    capture: true,
    passive: true,
  });
}

function detachGesture() {
  if (!gestureAttached || typeof document === "undefined") return;
  gestureAttached = false;
  document.removeEventListener("pointerdown", onGesture, { capture: true });
  document.removeEventListener("keydown", onGesture, { capture: true });
  document.removeEventListener("touchstart", onGesture, { capture: true });
}

/**
 * Registra um <audio> remoto. Retorna a função de cleanup (chame ao desmontar).
 */
export function registerRemoteAudio(el: HTMLAudioElement): () => void {
  elements.add(el);
  attachGesture();
  return () => {
    elements.delete(el);
    failed.delete(el);
    if (elements.size === 0) detachGesture();
    recompute();
  };
}

/** Força o play() em todos os elementos registrados (chamar dentro de um gesto). */
export async function unlockAudioNow(): Promise<void> {
  await Promise.allSettled(
    [...elements].map(async (el) => {
      try {
        await el.play();
        markPlay(el, true);
      } catch {
        markPlay(el, false);
      }
    }),
  );
}

/** Hook React: assina o estado "áudio remoto bloqueado pelo autoplay". */
export function useRemoteAudioBlocked(): boolean {
  const [value, setValue] = useState(blocked);
  useEffect(() => {
    listeners.add(setValue);
    setValue(blocked); // sincroniza com o estado atual ao montar
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
