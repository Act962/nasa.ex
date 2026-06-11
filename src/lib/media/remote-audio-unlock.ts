"use client";

/**
 * Destrava o autoplay dos <audio> remotos do mundo.
 *
 * Por que existe:
 *   O mundo toca o áudio remoto por <audio srcObject> PRÓPRIOS (não via
 *   `track.attach()` do LiveKit), então `room.startAudio()` não controla esses
 *   elementos. Em produção o navegador barra o `play()` deles até um gesto do
 *   usuário. Aqui tentamos tocar assim que o áudio chega e, se o navegador
 *   barrar, destravamos TODOS no primeiro gesto — clicar no microfone pra
 *   falar, mover o avatar, ou clicar em qualquer lugar. Sem banner: o gesto
 *   natural já resolve (igual ao POC, onde o clique de "entrar" libera o áudio).
 */

const elements = new Set<HTMLAudioElement>();
let gestureAttached = false;

function playAll() {
  for (const el of elements) {
    if (el.srcObject) el.play().catch(() => {});
  }
}

function onGesture() {
  playAll();
}

function attachGesture() {
  if (gestureAttached || typeof document === "undefined") return;
  gestureAttached = true;
  // capture=true pega o gesto antes do canvas do Phaser consumir o evento.
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

/** Registra um <audio> remoto. Retorna o cleanup (chame ao desmontar). */
export function registerRemoteAudio(el: HTMLAudioElement): () => void {
  elements.add(el);
  attachGesture();
  return () => {
    elements.delete(el);
    if (elements.size === 0) detachGesture();
  };
}

/**
 * Tenta tocar o elemento. Se o autoplay barrar, não tem problema: o próximo
 * gesto do usuário (mic, movimento, clique) destrava via `onGesture`.
 */
export function tryPlayRemoteAudio(el: HTMLAudioElement) {
  if (el.srcObject) el.play().catch(() => {});
}
