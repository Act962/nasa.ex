/**
 * Tipos compartilhados pelas sections pré-montadas. Cada section
 * tem seu próprio shape de props, mas todas seguem o padrão:
 *  - Lê dados do `element` (via element.<propName>)
 *  - Renderiza JSX completo do bloco
 *  - Aplica tokens de design (cor da marca, gradientes) quando disponíveis
 */
import type { DesignTokens, ElementBase } from "../../../types";

export interface SectionRendererProps {
  element: ElementBase;
  tokens?: DesignTokens;
  readonly?: boolean;
}

/** Shape pra item de lista (feature, benefit, faq). Usado por várias sections. */
export interface SectionListItem {
  id: string;
  icon?: string;
  title: string;
  description?: string;
  /** Pra pricing: valor formatado pra exibir. */
  value?: string;
  /** Badge opcional pegado em destaque. */
  badge?: string;
}

/** Resolve cor primary com fallback do token + default. */
export function primaryColor(
  element: ElementBase,
  tokens?: DesignTokens,
): string {
  return (
    (element.primaryColor as string) ??
    tokens?.colors?.primary ??
    "#7C3AED"
  );
}

export function bgColor(
  element: ElementBase,
  tokens?: DesignTokens,
): string {
  return (element.bgColor as string) ?? tokens?.colors?.bg ?? "#0f172a";
}

export function fgColor(
  element: ElementBase,
  tokens?: DesignTokens,
): string {
  return (element.fgColor as string) ?? tokens?.colors?.fg ?? "#f8fafc";
}

export function mutedColor(
  element: ElementBase,
  tokens?: DesignTokens,
): string {
  return (
    (element.mutedColor as string) ?? tokens?.colors?.muted ?? "#94a3b8"
  );
}
