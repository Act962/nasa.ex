"use client";

import { useState, useSyncExternalStore } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bot } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDisconnectExternalAi, useExternalAiConnections } from "../hooks/use-external-ai-connections";
import { MCP_PATH } from "../server/oauth-config";
import { CopyBlock } from "./copy-block";

/** Conectar pelo ChatGPT, claude.ai e outras IAs por OAuth (spec 0135, RF-11). */

const CONNECT_GUIDES = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    steps: [
      "No ChatGPT, abra Configurações › Plugins (ou Conectores) › Adicionar › Adicionar servidor MCP personalizado.",
      "Cole o endereço do servidor e escolha a autenticação OAuth.",
      "Confirme o aviso e clique em Conectar: o ÓRBITA abre para você entrar e clicar em Permitir.",
    ],
  },
  {
    id: "claude",
    label: "claude.ai",
    steps: [
      "No claude.ai, abra Configurações › Conectores › Adicionar conector personalizado.",
      "Cole o endereço do servidor e clique em Adicionar.",
      "Clique em Conectar: o ÓRBITA abre para você entrar e clicar em Permitir.",
    ],
  },
  {
    id: "other",
    label: "Outra IA",
    steps: [
      "Adicione um servidor MCP remoto (HTTP) com o endereço abaixo.",
      "Se a IA perguntar a autenticação, escolha OAuth: ela abre o ÓRBITA para você permitir.",
      "Se ela só aceitar chave (Claude Code, Codex, rotinas), gere uma chave logo abaixo.",
    ],
  },
] as const;

const subscribeToNothing = () => () => undefined;

// A origem só existe no navegador; o servidor renderiza o caminho relativo, sem diferença na hidratação.
function useServerUrl() {
  return useSyncExternalStore(
    subscribeToNothing,
    () => `${window.location.origin}${MCP_PATH}`,
    () => MCP_PATH,
  );
}

export function OAuthConnectPanel() {
  const serverUrl = useServerUrl();
  const [guideId, setGuideId] = useState<(typeof CONNECT_GUIDES)[number]["id"]>("chatgpt");
  const guide = CONNECT_GUIDES.find((connectGuide) => connectGuide.id === guideId) ?? CONNECT_GUIDES[0];
  const { connections } = useExternalAiConnections();
  const disconnect = useDisconnectExternalAi();

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="rounded-2xl bg-panel p-4">
        <p className="text-sm font-semibold">Conectar pelo ChatGPT, claude.ai e outras IAs</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sem chave: você entra na sua conta e permite. A IA usa os apps a que você tem acesso, em todas as suas empresas.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">Endereço do servidor</p>
        <CopyBlock text={serverUrl} />
        <div className="mt-3 flex flex-wrap gap-2">
          {CONNECT_GUIDES.map((connectGuide) => (
            <button
              key={connectGuide.id}
              type="button"
              onClick={() => setGuideId(connectGuide.id)}
              className={cn("rounded-full px-3 py-1.5 text-sm", connectGuide.id === guideId ? "bg-foreground font-semibold text-background" : "bg-card")}
            >
              {connectGuide.label}
            </button>
          ))}
        </div>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl bg-panel p-4">
        <p className="mb-2 text-sm font-semibold">IAs conectadas</p>
        {connections.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma IA conectada.</p>}
        <div className="space-y-2">
          {connections.map((connection) => (
            <div key={connection.id} className="flex items-center gap-2 rounded-xl bg-card p-2.5">
              <Bot className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{connection.clientName ?? "IA sem nome"}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {connection.connectedAt
                    ? `conectada ${formatDistanceToNow(new Date(connection.connectedAt), { locale: ptBR, addSuffix: true })}`
                    : "conectada"}
                </p>
              </div>
              <button
                type="button"
                disabled={disconnect.isPending}
                onClick={() =>
                  disconnect.mutate(
                    { connectionId: connection.id },
                    { onSuccess: () => toast.success("IA desconectada."), onError: (error) => toast.error(error.message) },
                  )
                }
                className="rounded-full bg-panel px-2.5 py-1 text-xs text-destructive"
              >
                Desconectar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
