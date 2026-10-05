import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import type { AstroBriefingApp } from "@/features/astro/lib/astro-briefing-apps";

const BRIEFING_STALE_MS = 5 * 60_000;

/** Resumo da semana do App aberto, mostrado como mensagem do Astro na tela inicial do painel (spec 0056). */
export function useAstroAppBriefing(app: AstroBriefingApp | undefined, options: { enabled?: boolean } = {}) {
  return useQuery({
    ...orpc.astro.appBriefing.queryOptions({ input: { app: app ?? "forms" } }),
    enabled: Boolean(app) && (options.enabled ?? true),
    staleTime: BRIEFING_STALE_MS,
    retry: false,
  });
}
