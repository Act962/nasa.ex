"use client";

/**
 * MobileJoystick — joystick virtual VISÍVEL pro mobile mexer o avatar no
 * NASA World. Renderiza um círculo base fixo no canto inferior-esquerdo e
 * um "knob" interno arrastável. Enquanto o dedo está ativo, dispara o
 * CustomEvent `space-station:virtual-joystick` com `{ active, dx, dy }`
 * (vetor já normalizado em pixels relativos ao centro da base, com
 * magnitude máxima = raio da base). O `WorldScene` ouve esse evento e
 * grava em `this.touchJoystick`, reusando o mesmo pipeline de conversão
 * vetor → up/down/left/right do teclado.
 *
 * Por quê visível em vez do drag-anywhere existente:
 *   1. Discoverability — o user vê de cara que tem onde tocar.
 *   2. Não compete com taps em avatares (Cutucar) e áreas — o joystick é
 *      uma área dedicada.
 *   3. Suporta toques contínuos sem precisar lembrar onde começou o drag.
 *
 * Renderiza só se `visible` for true (o pai usa `useIsMobile()`).
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  /** Quando false, não renderiza (use `useIsMobile()` no pai). */
  visible: boolean;
}

const BASE_SIZE = 120;        // diâmetro da base (px)
const KNOB_SIZE = 56;         // diâmetro do knob (px)
const MAX_RADIUS = (BASE_SIZE - KNOB_SIZE) / 2; // 32px — máximo de deslocamento do knob
const DISPATCH_THROTTLE_MS = 50; // ~20fps — suficiente pra mover suave

export function MobileJoystick({ visible }: Props) {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const centerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastDispatchRef = useRef(0);
  const [knobOffset, setKnobOffset] = useState<{ dx: number; dy: number }>({
    dx: 0,
    dy: 0,
  });

  // Dispara o vetor (active/dx/dy) pro WorldScene consumir.
  function dispatchVector(active: boolean, dx: number, dy: number) {
    const now = Date.now();
    if (active && now - lastDispatchRef.current < DISPATCH_THROTTLE_MS) return;
    lastDispatchRef.current = now;
    window.dispatchEvent(
      new CustomEvent("space-station:virtual-joystick", {
        detail: { active, dx, dy },
      }),
    );
  }

  function clampToRadius(dx: number, dy: number) {
    const mag = Math.hypot(dx, dy);
    if (mag <= MAX_RADIUS) return { dx, dy };
    const scale = MAX_RADIUS / mag;
    return { dx: dx * scale, dy: dy * scale };
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== null) return; // já tem um dedo ativo
    if (!baseRef.current) return;
    event.preventDefault();
    const rect = baseRef.current.getBoundingClientRect();
    centerRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    pointerIdRef.current = event.pointerId;
    baseRef.current.setPointerCapture(event.pointerId);
    // já dispara um knob position inicial baseado no clique
    const dx = event.clientX - centerRef.current.x;
    const dy = event.clientY - centerRef.current.y;
    const clamped = clampToRadius(dx, dy);
    setKnobOffset(clamped);
    dispatchVector(true, clamped.dx, clamped.dy);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - centerRef.current.x;
    const dy = event.clientY - centerRef.current.y;
    const clamped = clampToRadius(dx, dy);
    setKnobOffset(clamped);
    dispatchVector(true, clamped.dx, clamped.dy);
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId) return;
    pointerIdRef.current = null;
    try {
      baseRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    setKnobOffset({ dx: 0, dy: 0 });
    dispatchVector(false, 0, 0);
  }

  // Garante que se o componente desmontar mid-drag, libera o estado no scene
  useEffect(() => {
    return () => {
      if (pointerIdRef.current !== null) {
        window.dispatchEvent(
          new CustomEvent("space-station:virtual-joystick", {
            detail: { active: false, dx: 0, dy: 0 },
          }),
        );
      }
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-24 left-5 z-40 pointer-events-auto select-none"
      style={{ touchAction: "none" }}
      aria-label="Joystick virtual para mover o avatar"
    >
      <div
        ref={baseRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={onPointerEnd}
        className={cn(
          "relative rounded-full backdrop-blur-md border shadow-2xl",
          "bg-black/40 border-white/15 shadow-black/40",
          "flex items-center justify-center",
          "transition-colors",
        )}
        style={{ width: BASE_SIZE, height: BASE_SIZE }}
      >
        {/* anel interno indicando a área ativa */}
        <div
          className="absolute rounded-full border border-white/10"
          style={{
            width: BASE_SIZE - 16,
            height: BASE_SIZE - 16,
          }}
        />
        {/* knob arrastável */}
        <div
          className={cn(
            "rounded-full shadow-lg",
            "bg-gradient-to-br from-indigo-400/95 to-violet-500/95",
            "border border-white/30",
            "pointer-events-none",
          )}
          style={{
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            transform: `translate3d(${knobOffset.dx}px, ${knobOffset.dy}px, 0)`,
            transition:
              knobOffset.dx === 0 && knobOffset.dy === 0
                ? "transform 120ms ease-out"
                : "none",
          }}
        />
      </div>
    </div>
  );
}
