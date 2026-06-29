"use client";

import { AgentsList } from "@/features/auto-agent/components/agents-list";

/**
 * Tab "Agentes IA" dentro de Configurações do Tracking → Chatbot IA.
 *
 * Convenção do projeto: cada feature mora dentro de um tracking via tabs do
 * settings. Auto Agent fica ao lado de Geral/Botões/Modelo/Uso — UX coerente
 * com o resto do produto. Por isso a página standalone /tracking/[id]/agente
 * foi removida.
 */
export function ChatBotIaAgentsTab({ trackingId }: { trackingId: string }) {
  return (
    <div className="pt-2">
      <AgentsList trackingId={trackingId} />
    </div>
  );
}
