/**
 * Helper para converter `AnimationPreset` em props CSS aplicáveis.
 * Funciona em conjunto com `animations.css`.
 */
import type {
  AnimationPreset,
  AnimationPresetId,
  DesignTokens,
} from "../types";
import { ANIMATION_PRESET_IDS } from "../types";

export const ANIMATION_LABELS: Record<AnimationPresetId, string> = {
  fade: "Fade",
  "slide-up": "Slide ↑",
  "slide-down": "Slide ↓",
  "slide-left": "Slide ←",
  "slide-right": "Slide →",
  "zoom-in": "Zoom in",
  "zoom-out": "Zoom out",
  bounce: "Bounce",
  pulse: "Pulse",
  shake: "Shake",
  glow: "Glow",
  float: "Float",
  spin: "Spin",
  marquee: "Marquee",
  flow: "Flow",
};

/**
 * Produz a className CSS pra um `AnimationPreset` validado.
 * Preset desconhecido → string vazia.
 */
export function animationClassName(
  animation: AnimationPreset | undefined,
): string {
  if (!animation) return "";
  if (
    !ANIMATION_PRESET_IDS.includes(animation.preset as AnimationPresetId)
  ) {
    return "";
  }
  return `nasa-pages-anim-${animation.preset}`;
}

/**
 * Inline style overrides — sobrescreve duração/delay/easing default.
 */
export function animationStyle(
  animation: AnimationPreset | undefined,
): React.CSSProperties {
  if (!animation) return {};
  const style: React.CSSProperties = {};
  if (animation.durationMs)
    style.animationDuration = `${animation.durationMs}ms`;
  if (animation.delayMs) style.animationDelay = `${animation.delayMs}ms`;
  if (animation.easing) style.animationTimingFunction = animation.easing;
  return style;
}

/**
 * Resolve um gradiente nomeado ou retorna o valor literal.
 * Ex: `resolveGradient("gradient.primary", tokens)` → CSS gradient string.
 */
export function resolveGradient(
  value: string | undefined,
  tokens: DesignTokens | undefined,
): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith("gradient.")) return value;
  const key = value.replace("gradient.", "");
  return tokens?.gradients?.[key];
}

/**
 * Gradientes padrão do tema NASA — usados se a page não definir tokens
 * próprios. Funciona como fallback.
 */
export const DEFAULT_GRADIENTS: Record<string, string> = {
  primary: "linear-gradient(135deg, #7C3AED 0%, #a855f7 100%)",
  accent: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
  cool: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
  success: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  danger: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
  dark: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
  galaxy:
    "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #831843 100%)",
  sunset:
    "linear-gradient(135deg, #f59e0b 0%, #ec4899 50%, #8b5cf6 100%)",
};
