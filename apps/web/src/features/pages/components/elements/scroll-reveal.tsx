"use client";

/**
 * Wrapper que aplica um efeito de "scroll reveal" suave ao
 * elemento — entra quando o viewport o alcança e (opcionalmente)
 * volta ao estado inicial quando sai.
 *
 * Implementação:
 *   - `IntersectionObserver` detecta quando o elemento entra/sai do
 *     viewport com `threshold` configurável (default 15%).
 *   - Aplica `transform` + `opacity` inline com `transition` CSS — sem
 *     keyframes; o efeito é puramente uma interpolação entre dois
 *     estados (initial → final). Resultado: mais leve que animações
 *     keyframe e respeitando `prefers-reduced-motion` via mediaquery.
 *
 * Por que não usar a `AnimationPreset` existente (com `trigger: "scroll"`)?
 *   - A `AnimationPreset` é uma única animação que toca 1x quando entra.
 *     Quem usa scroll-reveal normalmente quer feedback bidirecional
 *     (entra+sai), então criamos um sistema dedicado mais flexível.
 *
 * Modo `replay = true` (default): a animação reverte ao sair e
 * roda de novo na próxima entrada. Modo `replay = false`: anima 1x,
 * fica visível pra sempre.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";

export type ScrollRevealPreset =
  | "fade"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "zoom-in"
  | "zoom-out"
  | "blur";

/**
 * Mapa preset → estilos `out` (estado inicial, elemento fora). O
 * estado `in` (visível) é sempre `opacity: 1; transform: none; filter:
 * none`. A `distance` multiplica o offset dos slides; pra fade/zoom
 * vira só ajuste de escala.
 */
function buildOutStyle(
  preset: ScrollRevealPreset,
  distance: number,
): CSSProperties {
  switch (preset) {
    case "fade":
      return { opacity: 0 };
    case "slide-up":
      return { opacity: 0, transform: `translate3d(0, ${distance}px, 0)` };
    case "slide-down":
      return { opacity: 0, transform: `translate3d(0, ${-distance}px, 0)` };
    case "slide-left":
      return { opacity: 0, transform: `translate3d(${distance}px, 0, 0)` };
    case "slide-right":
      return { opacity: 0, transform: `translate3d(${-distance}px, 0, 0)` };
    case "zoom-in":
      return { opacity: 0, transform: "scale(0.85)" };
    case "zoom-out":
      return { opacity: 0, transform: "scale(1.15)" };
    case "blur":
      return { opacity: 0, filter: "blur(12px)" };
  }
}

interface Props {
  preset?: ScrollRevealPreset;
  distance?: number;
  durationMs?: number;
  /** Atraso antes da animação rodar (ms). */
  delayMs?: number;
  /** Easing CSS. Default: cubic-bezier(0.22, 1, 0.36, 1) — fluido. */
  easing?: string;
  /** Fração do elemento visível pra disparar (0-1). Default 0.15. */
  threshold?: number;
  /** Se `true`, anima de volta ao estado inicial quando sai do viewport.
   *  Se `false`, anima 1x e mantém visível. Default true. */
  replay?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function ScrollReveal({
  preset = "slide-up",
  distance = 32,
  durationMs = 700,
  delayMs = 0,
  easing = "cubic-bezier(0.22, 1, 0.36, 1)",
  threshold = 0.15,
  replay = true,
  className,
  children,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  /** `null` = ainda não foi observado (aplicamos estado `out` pra evitar
   *  flash de conteúdo visível antes do observer ligar). */
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Browsers sem IntersectionObserver (raros em 2026): assume visível
    // como fallback gracioso — sem animação.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
        } else if (replay) {
          // Só "fecha" se replay habilitado — caso contrário deixa
          // visible=true (anima 1x e mantém).
          setVisible(false);
        }
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, replay]);

  const outStyle = buildOutStyle(preset, distance);
  const computedStyle: CSSProperties = {
    transition: `transform ${durationMs}ms ${easing} ${delayMs}ms, opacity ${durationMs}ms ${easing} ${delayMs}ms, filter ${durationMs}ms ${easing} ${delayMs}ms`,
    willChange: "transform, opacity, filter",
    ...(visible === false || visible === null ? outStyle : {}),
  };

  return (
    <div
      ref={ref}
      className={className}
      style={computedStyle}
      // Respeita prefers-reduced-motion sem JS — o CSS abaixo (injetado
      // pelo public renderer via `SmoothScrollStyle`) zera transitions
      // pra quem desabilitou animações no OS.
      data-scroll-reveal=""
    >
      {children}
    </div>
  );
}

/**
 * Helper pra extrair as props do JSON do element. Retorna `null` se
 * o efeito está desligado — caller deve renderizar `children` direto.
 */
export function getScrollRevealProps(
  element: { [key: string]: unknown },
): {
  preset: ScrollRevealPreset;
  distance: number;
  durationMs: number;
  delayMs: number;
  threshold: number;
  replay: boolean;
} | null {
  if (!element.scrollReveal) return null;
  return {
    preset:
      (element.scrollRevealPreset as ScrollRevealPreset | undefined) ??
      "slide-up",
    distance: (element.scrollRevealDistance as number) ?? 32,
    durationMs: (element.scrollRevealDurationMs as number) ?? 700,
    delayMs: (element.scrollRevealDelayMs as number) ?? 0,
    threshold: (element.scrollRevealThreshold as number) ?? 0.15,
    replay: (element.scrollRevealReplay as boolean | undefined) ?? true,
  };
}
