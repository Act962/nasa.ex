"use client";

/**
 * Wrapper que aplica o efeito "borda animada" (gradient deslizante)
 * inspirado no input do NASA Explorer no /home.
 *
 * Como funciona:
 *   - Div externo recebe `padding` = espessura da borda + classe
 *     `nasa-anim-border` (CSS em `animations.css`)
 *   - Div interno é background sólido — herda do parent (transparente
 *     por default) ou explícito via prop `innerBg`
 *   - O conteúdo (children) fica dentro do div interno
 *
 * Usado opcionalmente por qualquer element via `element.animatedBorder
 * = true` no editor. Cores e velocidade customizáveis pelo
 * properties-panel.
 */
import type { CSSProperties } from "react";

export const EXPLORER_GRADIENT_COLORS = [
  "#7C3AED",
  "#9333ea",
  "#a855f7",
  "#EC4899",
  "rgba(255, 255, 255, 0.92)",
] as const;

/**
 * Monta a string `linear-gradient(270deg, ...)` espelhando o efeito do
 * Explorer — repete as cores em sequência reversa após o branco pra
 * que o loop seja simétrico e o "brilho" central retorne.
 */
export function buildAnimatedBorderGradient(colors: readonly string[]): string {
  if (colors.length === 0) return "";
  const reversed = [...colors].reverse();
  // Não duplica a "cor de brilho" (última do array original) na transição
  const palette = [...colors, ...reversed.slice(1)];
  return `linear-gradient(270deg, ${palette.join(", ")})`;
}

interface Props {
  /** Cores do gradiente (asc), espelhadas internamente pra loop simétrico. */
  colors?: readonly string[];
  /** Espessura da borda (px). Default 1.5. */
  width?: number;
  /** Duração da animação (s). Default 5. */
  speedSec?: number;
  /** Raio do canto. Default 16. */
  radius?: number;
  /** Fundo interno. Default `transparent` (deixa passar o conteúdo do parent). */
  innerBg?: string;
  /** Estilo extra do wrapper interno. */
  innerStyle?: CSSProperties;
  className?: string;
  children: React.ReactNode;
}

export function AnimatedBorder({
  colors = EXPLORER_GRADIENT_COLORS,
  width = 1.5,
  speedSec = 5,
  radius = 16,
  innerBg = "transparent",
  innerStyle,
  className,
  children,
}: Props) {
  const gradient = buildAnimatedBorderGradient(colors);
  return (
    <div
      className={`nasa-anim-border ${className ?? ""}`}
      style={{
        ["--nasa-anim-border-gradient" as string]: gradient,
        ["--nasa-anim-border-speed" as string]: `${speedSec}s`,
        ["--nasa-anim-border-radius" as string]: `${radius}px`,
        padding: width,
        // Mantém w/h do parent — não infla
        width: "100%",
        height: "100%",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: innerBg,
          borderRadius: Math.max(0, radius - width),
          overflow: "hidden",
          ...innerStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Helper pra detectar se um element tem `animatedBorder` habilitado e
 * extrair as props necessárias do JSON do layout. Retorna `null` se
 * desabilitado.
 */
export function getAnimatedBorderProps(
  element: { [key: string]: unknown },
): {
  colors: string[];
  width: number;
  speedSec: number;
  radius: number;
} | null {
  if (!element.animatedBorder) return null;
  const colors =
    (element.animatedBorderColors as string[] | undefined)?.filter(Boolean) ??
    [...EXPLORER_GRADIENT_COLORS];
  return {
    colors,
    width: (element.animatedBorderWidth as number) ?? 1.5,
    speedSec: (element.animatedBorderSpeed as number) ?? 5,
    radius: (element.animatedBorderRadius as number) ?? 16,
  };
}

/**
 * Variante específica pra cards INDIVIDUAIS dentro de sections
 * compostas (depoimentos, features, planos, FAQ). Lê props prefixadas
 * com `card*` — assim a section pode ter borda animada por fora
 * (`animatedBorder`) E também por card (`cardAnimatedBorder`) sem
 * colidir nomes.
 *
 * Usa o `cardRadius` do próprio section como raio default (cada section
 * já tem essa prop pra controlar arredondamento dos cards).
 */
export function getCardAnimatedBorderProps(
  element: { [key: string]: unknown },
): {
  colors: string[];
  width: number;
  speedSec: number;
  radius: number;
} | null {
  if (!element.cardAnimatedBorder) return null;
  const colors =
    (element.cardAnimatedBorderColors as string[] | undefined)?.filter(Boolean) ??
    [...EXPLORER_GRADIENT_COLORS];
  return {
    colors,
    width: (element.cardAnimatedBorderWidth as number) ?? 1.5,
    speedSec: (element.cardAnimatedBorderSpeed as number) ?? 5,
    // Default segue o `cardRadius` da section pra que a borda animada
    // siga o arredondamento já configurado dos cards.
    radius:
      (element.cardAnimatedBorderRadius as number) ??
      (element.cardRadius as number) ??
      16,
  };
}

/**
 * Helper de render — envolve um `child` com `<AnimatedBorder>` se a
 * section tiver `cardAnimatedBorder` habilitado. Caso contrário,
 * devolve o child direto (zero overhead). Use dentro dos renderers das
 * sections compostas (testimonials, features, pricing, faq).
 */
export function wrapCardWithAnimatedBorder(
  element: { [key: string]: unknown },
  child: React.ReactNode,
): React.ReactNode {
  const props = getCardAnimatedBorderProps(element);
  if (!props) return child;
  return (
    <AnimatedBorder
      colors={props.colors}
      width={props.width}
      speedSec={props.speedSec}
      radius={props.radius}
    >
      {child}
    </AnimatedBorder>
  );
}
