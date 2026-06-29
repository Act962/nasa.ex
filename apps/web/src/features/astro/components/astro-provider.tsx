"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AgentKey } from "@/features/astro/schemas/agent-config";
import type { AstroRouteContext } from "@/features/astro/schemas/chat-message";
import { useAstroContext as useRouteContext } from "@/features/astro/hooks/use-astro-context";

export type AstroSurfaceMode = "full" | "fullscreen" | "embed";

interface AstroContextValue {
  /** Sessão ativa do `useChat`. `null` antes da 1ª mensagem (será criada via oRPC). */
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  /** Snapshot da rota — mesmo objeto compartilhado pelas surfaces. */
  routeContext: AstroRouteContext;
}

const AstroCtx = createContext<AstroContextValue | null>(null);

/**
 * Provider raiz montado em `platform-providers.tsx`. Mantém o `sessionId`
 * compartilhado entre o widget global e qualquer outra surface aberta na
 * mesma página. Embeds (tracking-chat, lead) montam um sub-provider próprio
 * com seu `sessionId` isolado.
 */
export function AstroProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const routeContext = useRouteContext();

  const value = useMemo<AstroContextValue>(
    () => ({ sessionId, setSessionId, routeContext }),
    [sessionId, routeContext],
  );

  return <AstroCtx.Provider value={value}>{children}</AstroCtx.Provider>;
}

export function useAstro(): AstroContextValue {
  const ctx = useContext(AstroCtx);
  if (!ctx) {
    throw new Error("useAstro deve estar dentro de <AstroProvider>");
  }
  return ctx;
}

/**
 * Para embeds (tracking-chat, lead detail, etc) que precisam ter sua própria
 * sessão isolada do widget global. Reaproveita o routeContext do parent.
 */
export function AstroEmbedScope({
  children,
  initialSessionId = null,
}: {
  children: ReactNode;
  initialSessionId?: string | null;
}) {
  const parent = useContext(AstroCtx);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);

  const value = useMemo<AstroContextValue>(
    () => ({
      sessionId,
      setSessionId,
      routeContext: parent?.routeContext ?? {},
    }),
    [sessionId, parent?.routeContext],
  );

  return <AstroCtx.Provider value={value}>{children}</AstroCtx.Provider>;
}

export type { AgentKey };
