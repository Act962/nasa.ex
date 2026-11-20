"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";
import { DISABLED_AI_CAPABILITIES, type AiCapabilities } from "@/features/tracking-chat-ai/lib/capabilities";
import { useState } from "react";
import { toast } from "sonner";
import { useAiCapabilities, useUpdateAiCapabilities } from "../hooks/use-ai-capabilities";
import { AiCapabilitiesEditor, type AiCapabilityOptions } from "./ai-capabilities-editor";

// Aba "O que o Astro pode fazer" do Chatbot IA (spec 0084). Tudo começa desligado.

function CapabilitiesForm({
  trackingId,
  savedCapabilities,
  options,
  canSave,
  isAttendanceManaged,
}: {
  trackingId: string;
  savedCapabilities: AiCapabilities;
  options: AiCapabilityOptions;
  canSave: boolean;
  isAttendanceManaged: boolean;
}) {
  const [capabilities, setCapabilities] = useState<AiCapabilities>(savedCapabilities);
  const updateCapabilities = useUpdateAiCapabilities();

  const handleSave = () => {
    // Linha de link em branco não é erro: só não é salva.
    const filledLinks = capabilities.links.items.filter((link) => link.label.trim() && link.url.trim());
    updateCapabilities.mutate(
      { trackingId, capabilities: { ...capabilities, links: { ...capabilities.links, items: filledLinks } } },
      {
        onSuccess: () => toast.success("Opções do Astro salvas"),
        onError: (error) => toast.error(error.message || "Erro ao salvar"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Cada opção ligada dá ao Astro só aquela capacidade, sempre presa ao cliente da conversa: ele
        nunca vê dados de outra pessoa nem da empresa. “Falar com atendente” funciona sempre.
      </p>

      <AiCapabilitiesEditor
        capabilities={capabilities}
        onChange={setCapabilities}
        options={options}
        scope="funnel"
        isAttendanceManaged={isAttendanceManaged}
      />

      {!canSave && (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Preencha e salve a aba Geral do Fluxo de atendimento antes de ligar estas opções.
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!canSave || updateCapabilities.isPending}>
          {updateCapabilities.isPending ? <Spinner /> : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

export function ChatBotIaCapabilitiesTab({ trackingId }: { trackingId: string }) {
  const { data, isLoading } = useAiCapabilities(trackingId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <CapabilitiesForm
      key={JSON.stringify(data?.capabilities ?? null)}
      trackingId={trackingId}
      savedCapabilities={data?.capabilities ?? DISABLED_AI_CAPABILITIES}
      options={{
        agendas: data?.availableAgendas ?? [],
        forms: data?.availableForms ?? [],
        workspaces: data?.availableWorkspaces ?? [],
        knowledge: data?.availableKnowledge ?? [],
      }}
      canSave={data?.hasAiSettings ?? false}
      isAttendanceManaged={data?.isAttendanceManaged ?? false}
    />
  );
}
