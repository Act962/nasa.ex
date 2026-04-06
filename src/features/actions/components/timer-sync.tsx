"use client";

import { useActiveTimer } from "../hooks/use-timer";

/**
 * Componente invisível responsável por manter o Zustand Timer Store
 * sincronizado com o servidor globalmente (em todas as páginas).
 */
export function TimerSync() {
  // O hook useActiveTimer já contém a lógica de useEffect que sincroniza com o Store
  useActiveTimer();
  
  return null;
}
