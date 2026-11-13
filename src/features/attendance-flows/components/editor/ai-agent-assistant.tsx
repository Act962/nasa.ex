"use client";

// Assistente próprio do bloco Agente de IA (spec 0139, D-14): nome, jeito de falar e o que a IA pode fazer nesta etapa,
// copiados do funil ou feitos do zero. Sem assistente próprio, o bloco usa a IA do funil do número, como antes.
import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DISABLED_AI_CAPABILITIES, pickBlockCapabilities, type AiCapabilities } from "@/features/tracking-chat-ai/lib/capabilities";
import { AiCapabilitiesEditor } from "@/features/tracking-settings/components/ai-capabilities-editor";
import { VariableTextarea } from "./variable-textarea";
import { useAttendanceAiOptions, useAttendanceNumberOptions, useImportFunnelAi } from "../../hooks/use-attendance-flows";

type NodeData = Record<string, unknown>;
type RawAssistant = { assistantName?: unknown; prompt?: unknown; capabilities?: unknown };

function rawAssistantOf(data: NodeData): RawAssistant | null {
  const assistant = data.assistant;
  return assistant && typeof assistant === "object" && !Array.isArray(assistant) ? (assistant as RawAssistant) : null;
}

/** O editor trabalha com o valor como foi digitado (link pela metade incluso); a limpeza fica para o salvar. */
function editableCapabilities(assistant: RawAssistant): AiCapabilities {
  const saved = assistant.capabilities && typeof assistant.capabilities === "object" ? (assistant.capabilities as Partial<AiCapabilities>) : {};
  return { ...DISABLED_AI_CAPABILITIES, ...saved };
}

function ImportFromFunnel({ onImported, label }: { onImported: (assistant: RawAssistant) => void; label: string }) {
  const { data: numberOptions } = useAttendanceNumberOptions();
  const importFunnelAi = useImportFunnelAi();
  const [trackingId, setTrackingId] = useState<string>("");
  const numbers = numberOptions?.numbers ?? [];
  const handleImport = () =>
    importFunnelAi.mutate(trackingId, {
      onSuccess: (assistant) => {
        onImported(assistant);
        toast.success("Configuração copiada do funil");
      },
      onError: (error) => toast.error(error.message),
    });
  return (
    <div className="space-y-2">
      <Select value={trackingId} onValueChange={setTrackingId}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Escolha o funil" />
        </SelectTrigger>
        <SelectContent>
          {numbers.map((number) => (
            <SelectItem key={number.trackingId} value={number.trackingId}>
              {number.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" className="w-full" disabled={!trackingId || importFunnelAi.isPending} onClick={handleImport}>
        <DownloadIcon className="size-4" /> {label}
      </Button>
    </div>
  );
}

export function AiAgentAssistantSection({ data, onChange }: { data: NodeData; onChange: (data: NodeData) => void }) {
  const assistant = rawAssistantOf(data);
  const setAssistant = (next: RawAssistant | null) => {
    if (next) {
      onChange({ ...data, assistant: next });
      return;
    }
    const { assistant: _removed, ...rest } = data;
    onChange(rest);
  };

  if (!assistant) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          Esta etapa usa a IA do funil do número por onde o lead chegou: nome, prompt e o que ela pode fazer. Copie de um funil
          para o bloco valer sozinho, igual em todos os números.
        </p>
        <div className="space-y-1.5">
          <Label>Copiar a IA de um funil</Label>
          <ImportFromFunnel label="Importar do funil" onImported={setAssistant} />
        </div>
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setAssistant({ assistantName: "", prompt: "", capabilities: {} })}>
          Configurar do zero
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Nome da assistente</Label>
        <Input value={String(assistant.assistantName ?? "")} placeholder="Astro" onChange={(event) => setAssistant({ ...assistant, assistantName: event.target.value })} />
        <p className="text-xs text-muted-foreground">Nome com que a IA se apresenta.</p>
      </div>
      <div className="space-y-1.5">
        <Label>Prompt</Label>
        <VariableTextarea
          rows={5}
          value={String(assistant.prompt ?? "")}
          placeholder="Você é a assistente da empresa. Fale de forma simpática e direta..."
          onChange={(prompt) => setAssistant({ ...assistant, prompt })}
        />
        <p className="text-xs text-muted-foreground">Quem é a IA e como ela fala. As instruções da aba Etapa valem por cima.</p>
      </div>
      <div className="space-y-1.5 border-t pt-4">
        <Label>Copiar de novo de um funil</Label>
        <ImportFromFunnel label="Substituir pelo funil" onImported={setAssistant} />
      </div>
      <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setAssistant(null)}>
        Voltar a usar a IA do funil
      </Button>
    </div>
  );
}

export function AiAgentCapabilitiesSection({ data, onChange }: { data: NodeData; onChange: (data: NodeData) => void }) {
  const assistant = rawAssistantOf(data);
  const { data: options } = useAttendanceAiOptions();
  if (!assistant) {
    return (
      <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        Sem assistente próprio, valem as opções de &quot;O que o Astro pode fazer&quot; do funil do número. Importe ou configure
        na aba Assistente para escolher aqui.
      </p>
    );
  }
  return (
    <AiCapabilitiesEditor
      scope="block"
      capabilities={editableCapabilities(assistant)}
      options={options ?? { agendas: [], forms: [], workspaces: [], knowledge: [] }}
      onChange={(capabilities) => onChange({ ...data, assistant: { ...assistant, capabilities: pickBlockCapabilities(capabilities) } })}
    />
  );
}
