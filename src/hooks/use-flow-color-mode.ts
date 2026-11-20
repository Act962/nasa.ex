"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

const subscribeNoop = () => () => {};

/**
 * Tema do canvas do React Flow. Sem `colorMode`, ele põe a classe `light` no próprio canvas, e o `globals.css` define as
 * cores claras em `.light`: no modo escuro os cartões dentro do canvas voltavam a ficar brancos. Use em todo `<ReactFlow>`.
 * No servidor o tema é desconhecido: devolve "light" até a página montar no navegador, porque o React não corrige a classe
 * que difere entre o HTML do servidor e o do navegador.
 */
export function useFlowColorMode(): "dark" | "light" {
  const { resolvedTheme } = useTheme();
  const isMounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  return isMounted && resolvedTheme === "dark" ? "dark" : "light";
}
