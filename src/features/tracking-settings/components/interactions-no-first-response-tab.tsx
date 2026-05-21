"use client";

import { InteractionsScenarioForm } from "./interactions-scenario-form";

export function InteractionsNoFirstResponseTab({
  trackingId,
}: {
  trackingId: string;
}) {
  return (
    <InteractionsScenarioForm
      trackingId={trackingId}
      scenario="noFirstResp"
      copy={{
        title: "Sem 1ª resposta",
        description:
          "Aciona quando um lead entrou no funil e ninguém respondeu ainda dentro do tempo configurado.",
        activeLabel: "Ativar automação",
        activeDescription:
          "Quando ativo, leads que ficarem sem 1ª resposta receberão as ações abaixo.",
      }}
    />
  );
}
