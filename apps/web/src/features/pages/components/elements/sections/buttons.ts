/**
 * Helper para sections que renderizam **botões variáveis**.
 *
 * Antes, hero/cta tinham `primaryCta` + `secondaryCta` hardcoded (só
 * 2 botões). Agora suportam `buttons: SectionButton[]` — N botões
 * com variant (primary / outline / ghost).
 *
 * `resolveButtons(el)` retorna a lista final, fazendo fallback
 * automático: se `buttons[]` não existir mas legacy `primaryCta` /
 * `secondaryCta` existirem, monta a lista a partir deles. Isso
 * garante que páginas antigas continuam renderizando enquanto a
 * UI nova permite editar livremente.
 */
import { createElement, type CSSProperties, type ReactNode } from "react";
import type { ElementBase } from "../../../types";

export type SectionButton = {
  id: string;
  label: string;
  href: string;
  variant: "primary" | "outline" | "ghost";
  // Cores opcionais por botão. Quando setadas, sobrescrevem as
  // cores derivadas do variant (background do "primary", borda do
  // "outline", etc). Permite ter botões com cores diferentes na
  // mesma section sem mexer nos tokens globais.
  bgColor?: string;
  fgColor?: string;
};

export function resolveButtons(
  el: ElementBase,
  opts?: { defaultPrimary?: string; defaultSecondary?: string },
): SectionButton[] {
  const arr = el.buttons as SectionButton[] | undefined;
  if (Array.isArray(arr)) {
    // Filtra entries vazias (label vazio) — user pode ter deixado
    // um botão sem label. Em vez de renderizar caixa em branco,
    // simplesmente esconde.
    return arr.filter((b) => b && (b.label ?? "").trim().length > 0);
  }
  // Fallback legacy — primaryCta + secondaryCta
  const out: SectionButton[] = [];
  const primary = (el.primaryCta as string) ?? opts?.defaultPrimary ?? "";
  const secondary =
    (el.secondaryCta as string) ?? opts?.defaultSecondary ?? "";
  if (primary) {
    out.push({
      id: "legacy-primary",
      label: primary,
      href: (el.primaryCtaHref as string) ?? "#",
      variant: "primary",
    });
  }
  if (secondary) {
    out.push({
      id: "legacy-secondary",
      label: secondary,
      href: (el.secondaryCtaHref as string) ?? "#",
      variant: "outline",
    });
  }
  return out;
}

/**
 * Migra do shape legado pro novo. Usado no editor: quando o user
 * vai mexer em botões pela primeira vez, convertemos legacy →
 * buttons[] pra trabalhar com lista normalizada.
 *
 * NÃO remove os campos legados — fica seguro com paginas antigas
 * (se buttons[] for limpado, cai pro legacy de novo).
 */
export function legacyToButtonsList(el: ElementBase): SectionButton[] {
  const existing = el.buttons as SectionButton[] | undefined;
  if (Array.isArray(existing) && existing.length > 0) return existing;
  return resolveButtons(el);
}

/**
 * Renderiza um botão de section como <a> estilizado.
 * `size` ajusta padding (md = hero/cta médios, lg = CTAs grandes).
 */
export function renderSectionButton(
  b: SectionButton,
  opts: {
    primary: string;
    fg: string;
    size?: "md" | "lg";
    textShadow?: string;
  },
): ReactNode {
  const { primary, fg, size = "md", textShadow } = opts;
  const padding =
    size === "lg" ? "px-8 py-3.5 sm:py-4" : "px-7 py-3 sm:py-3.5";

  // Override de cores por botão. Se setado, sobrescreve a cor
  // derivada do variant.
  const customBg = b.bgColor;
  const customFg = b.fgColor;

  const styles: Record<SectionButton["variant"], CSSProperties> = {
    primary: {
      background: customBg ?? primary,
      color: customFg ?? "#fff",
      textDecoration: "none",
      boxShadow:
        size === "lg"
          ? `0 0 40px ${(customBg ?? primary)}50`
          : `0 8px 24px ${(customBg ?? primary)}30`,
      textShadow,
    },
    outline: {
      color: customFg ?? fg,
      borderColor: customBg ?? `${fg}30`,
      background: customBg ? `${customBg}10` : "transparent",
      textDecoration: "none",
      textShadow,
    },
    ghost: {
      color: customFg ?? customBg ?? fg,
      background: "transparent",
      textDecoration: "underline",
      textShadow,
    },
  };

  const classNames: Record<SectionButton["variant"], string> = {
    primary: `text-sm font-extrabold ${padding} rounded-xl transition-opacity hover:opacity-90 inline-flex items-center justify-center`,
    outline: `text-sm font-semibold ${padding} rounded-xl transition-colors hover:bg-white/5 border inline-flex items-center justify-center`,
    ghost: `text-sm font-semibold ${padding} rounded-xl transition-colors hover:opacity-80 inline-flex items-center justify-center`,
  };

  return createElement(
    "a",
    {
      key: b.id,
      href: b.href || "#",
      className: classNames[b.variant] ?? classNames.outline,
      style: styles[b.variant] ?? styles.outline,
    },
    b.label,
  );
}
