import { getContrastColor } from "@/utils/get-contrast-color";

/**
 * Tema dos campos dentro de um formulário. O fundo é a cor escolhida pela
 * empresa e não acompanha o tema da plataforma (design system, D-3); sem fixar
 * o tema da área, um campo escuro caía sobre fundo claro com letra escura.
 * Devolve a classe que fixa os tokens (`light` ou `dark`), ou "" sem cor definida.
 */
export function formSurfaceThemeClass(backgroundColor: string | null | undefined): "light" | "dark" | "" {
  if (!backgroundColor || !/^#?[0-9a-fA-F]{6}$/.test(backgroundColor.trim())) return "";
  return getContrastColor(backgroundColor.trim()) === "#000000" ? "light" : "dark";
}
