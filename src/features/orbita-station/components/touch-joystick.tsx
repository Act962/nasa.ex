"use client";

import { useRef, useState } from "react";

const RADIUS_PX = 48;

/** Joystick na tela para aparelho de toque: devolve x para a direita e y para cima, de -1 a 1. */
export function TouchJoystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const updateFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = baseRef.current!.getBoundingClientRect();
    let offsetX = event.clientX - (rect.left + rect.width / 2);
    let offsetY = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(offsetX, offsetY);
    if (distance > RADIUS_PX) {
      offsetX = (offsetX / distance) * RADIUS_PX;
      offsetY = (offsetY / distance) * RADIUS_PX;
    }
    setKnob({ x: offsetX, y: offsetY });
    onMove(offsetX / RADIUS_PX, -offsetY / RADIUS_PX);
  };
  const release = () => {
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div
      ref={baseRef}
      role="application"
      aria-label="Controle de movimento"
      className="pointer-events-auto relative size-32 touch-none rounded-full border border-white/25 bg-white/10 backdrop-blur-sm"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromPointer(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div
        className="absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 shadow-[0_0_18px_rgba(61,224,240,0.7)]"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}
