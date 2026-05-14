"use client";

import { useEffect, useState } from "react";

/**
 * Contador regressivo até `target`. Atualiza a cada 30s — boa granularidade
 * pra mostrar "47 min" sem disparar re-render absurdo. Quando vence, retorna
 * `expired: true` e congela.
 *
 * Uso:
 *   const { msLeft, label, expired } = useCountdown(expiresAt);
 *
 * Formato do label:
 *   - expirado            → "Expirado"
 *   - < 1 min restante    → "Expira em menos de 1 min"
 *   - < 60 min            → "Expira em N min"
 *   - >= 60 min           → "Expira em Hh Mmin"
 */
export interface CountdownState {
  msLeft: number;
  label: string;
  expired: boolean;
}

const TICK_MS = 30_000;

function formatLabel(msLeft: number, expired: boolean): string {
  if (expired) return "Expirado";
  if (msLeft < 60_000) return "Expira em menos de 1 min";
  const totalMin = Math.floor(msLeft / 60_000);
  if (totalMin < 60) return `Expira em ${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `Expira em ${h}h ${m}min` : `Expira em ${h}h`;
}

function computeState(target: Date | string | null): CountdownState {
  if (!target) {
    return { msLeft: 0, label: "Expirado", expired: true };
  }
  const t = target instanceof Date ? target : new Date(target);
  const msLeft = t.getTime() - Date.now();
  const expired = msLeft <= 0;
  return {
    msLeft: Math.max(0, msLeft),
    label: formatLabel(msLeft, expired),
    expired,
  };
}

export function useCountdown(target: Date | string | null): CountdownState {
  const [state, setState] = useState<CountdownState>(() => computeState(target));

  useEffect(() => {
    // Recalcula imediatamente quando o target muda.
    setState(computeState(target));
    if (!target) return;
    const id = setInterval(() => {
      setState(computeState(target));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [target]);

  return state;
}
