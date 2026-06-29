"use client";

import type { StepAnnotation } from "../types";
import { cn } from "@/lib/utils";

interface Props {
  src: string | null;
  alt?: string;
  annotations?: StepAnnotation[] | null;
  className?: string;
  showPlaceholder?: boolean;
}

/**
 * Imagem com overlay SVG de setas e labels apontando para regiões da tela.
 * Coordenadas em annotations são relativas (0-1) para responsividade.
 * Quando não há `src` e `showPlaceholder=false`, retorna null (esconde a área).
 */
export function StepScreenshot({
  src,
  alt = "",
  annotations,
  className,
  showPlaceholder = false,
}: Props) {
  if (!src && !showPlaceholder) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-muted/40 shadow-sm",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="block w-full h-auto" />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-violet-500/10 to-violet-700/20 text-muted-foreground">
          <div className="text-center px-6">
            <div className="text-5xl mb-2">🖼️</div>
            <p className="text-sm font-medium">Print da funcionalidade</p>
            <p className="text-xs opacity-70">(será adicionado pelo moderador)</p>
          </div>
        </div>
      )}

      {annotations && annotations.length > 0 && (
        <svg
          className="absolute inset-0 h-full w-full pointer-events-none"
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
        >
          <defs>
            <marker
              id="sh-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#7C3AED" />
            </marker>
            <marker
              id="sh-rocket-right"
              viewBox="0 0 24 24"
              refX="22"
              refY="12"
              markerWidth="7"
              markerHeight="7"
              orient="0"
            >
              <g fill="#DC2626" stroke="#7F1D1D" strokeWidth="0.6" strokeLinejoin="round">
                <path d="M2 12 L9 9 L9 15 Z" />
                <path d="M9 7 L18 9 C21 10 22 11 22 12 C22 13 21 14 18 15 L9 17 Z" />
                <circle cx="17" cy="12" r="1.6" fill="#FECACA" stroke="#7F1D1D" strokeWidth="0.4" />
              </g>
            </marker>
            <marker
              id="sh-rocket-left"
              viewBox="0 0 24 24"
              refX="2"
              refY="12"
              markerWidth="7"
              markerHeight="7"
              orient="0"
            >
              <g fill="#DC2626" stroke="#7F1D1D" strokeWidth="0.6" strokeLinejoin="round">
                <path d="M22 12 L15 9 L15 15 Z" />
                <path d="M15 7 L6 9 C3 10 2 11 2 12 C2 13 3 14 6 15 L15 17 Z" />
                <circle cx="7" cy="12" r="1.6" fill="#FECACA" stroke="#7F1D1D" strokeWidth="0.4" />
              </g>
            </marker>
          </defs>
          {annotations.map((a, i) => {
            const isRocketRight = a.marker === "rocket-right";
            const isRocketLeft = a.marker === "rocket-left";
            const isRocket = isRocketRight || isRocketLeft;
            const stroke = isRocket ? "#DC2626" : "#7C3AED";
            const markerId = isRocketRight
              ? "sh-rocket-right"
              : isRocketLeft
              ? "sh-rocket-left"
              : "sh-arrow";
            const tailLen = 0.09;
            const baseAngle = isRocketRight ? 180 : isRocketLeft ? 0 : a.angle;
            const rad = (baseAngle * Math.PI) / 180;
            const tailX = a.x + Math.cos(rad) * tailLen;
            const tailY = a.y + Math.sin(rad) * tailLen;
            return (
              <g key={i}>
                <line
                  x1={tailX}
                  y1={tailY}
                  x2={a.x}
                  y2={a.y}
                  stroke={stroke}
                  strokeWidth="0.005"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  markerEnd={`url(#${markerId})`}
                  style={{ strokeWidth: 3 }}
                />
              </g>
            );
          })}
        </svg>
      )}

      {annotations && annotations.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {annotations.map((a, i) => {
            const isRocket = a.marker === "rocket-right" || a.marker === "rocket-left";
            return (
              <div
                key={i}
                className={cn(
                  "absolute px-2 py-0.5 rounded-md text-white text-[11px] font-medium shadow-md whitespace-nowrap",
                  isRocket ? "bg-red-600" : "bg-violet-600",
                )}
                style={{
                  left: `${a.x * 100}%`,
                  top: `${a.y * 100}%`,
                  transform: `translate(-50%, calc(-100% - 8px))`,
                }}
              >
                {a.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
