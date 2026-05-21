"use client";

import { InteractionsScenarioForm } from "./interactions-scenario-form";

export function InteractionsInConvTab({
  trackingId,
}: {
  trackingId: string;
}) {
  return (
    <InteractionsScenarioForm
      trackingId={trackingId}
      scenario="inConv"
      copy={{
        title: "Em conversa",
        description:
          "Aciona quando um lead já está em conversa (com 1ª resposta enviada) mas o atendente ficou tempo demais sem responder.",
        activeLabel: "Ativar automação",
        activeDescription:
          "Quando ativo, leads em conversa parada receberão as ações abaixo.",
      }}
    />
  );
}
