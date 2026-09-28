"use client";

import { createContext, useContext } from "react";

/**
 * Prefixo das rotas do trafeGO.
 *
 * Em produção é vazio — os links apontam para `/trafego/painel` e
 * `/admin/trafego`. Nas telas de preview (`/trafego/preview/*`) o provider
 * injeta o prefixo, para a navegação continuar dentro do preview em vez de
 * cair no login.
 *
 * Fica num contexto em vez de prop para não obrigar cada componente
 * intermediário a repassar o valor.
 */
const TrafegoBasePathContext = createContext<string>("");

export function TrafegoBasePathProvider({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <TrafegoBasePathContext.Provider value={value}>
      {children}
    </TrafegoBasePathContext.Provider>
  );
}

/** Monta uma rota do painel do cliente respeitando o contexto. */
export function usePanelPath(suffix = ""): string {
  const base = useContext(TrafegoBasePathContext);
  return `${base}/trafego/painel${suffix}`;
}

/** Monta uma rota do painel da equipe respeitando o contexto. */
export function useAdminPath(suffix = ""): string {
  const base = useContext(TrafegoBasePathContext);
  // No preview o painel da equipe vive sob /trafego/preview/admin.
  return base ? `${base}/admin${suffix}` : `/admin/trafego${suffix}`;
}
