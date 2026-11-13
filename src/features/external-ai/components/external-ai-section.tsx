"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clapperboard, Download, KeyRound, Plug } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { usePlannerClients } from "@/features/nasa-planner/hooks/use-planner-calendar";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useCreateExternalAiToken, useExternalAiTokens, useRevokeExternalAiToken } from "../hooks/use-external-ai-tokens";
import { MCP_PATH } from "../server/oauth-config";
import { CopyBlock } from "./copy-block";
import { OAuthConnectPanel } from "./oauth-connect-panel";

/** Satélites → IA externa (spec 0065, RF-5): chave do MCP do ÓRBITA para Claude Code e outras IAs. */

function buildClaudeCommand(token: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `claude mcp add --transport http orbita ${origin}${MCP_PATH} --header "Authorization: Bearer ${token}"`;
}

export function ExternalAiSection() {
  const { clients } = usePlannerClients();
  const { tokens, canIncludeTrafego } = useExternalAiTokens();
  const createToken = useCreateExternalAiToken();
  const revokeToken = useRevokeExternalAiToken();
  const [label, setLabel] = useState("Claude Code");
  const [selectedOrganizationIds, setSelectedOrganizationIds] = useState<string[]>([]);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  // Spec 0131: ferramentas do trafeGO na chave, só para a equipe.
  const [shouldIncludeTrafego, setShouldIncludeTrafego] = useState(false);
  const creatableClients = clients.filter((client) => client.permissions.canCreate);
  const organizationIds = selectedOrganizationIds.length ? selectedOrganizationIds : creatableClients.slice(0, 1).map((client) => client.id);

  const toggleOrganization = (organizationId: string) =>
    setSelectedOrganizationIds((current) => {
      const base = current.length ? current : organizationIds;
      return base.includes(organizationId) ? base.filter((id) => id !== organizationId) : [...base, organizationId];
    });

  const generate = () =>
    createToken.mutate(
      { label, organizationIds, includeTrafego: canIncludeTrafego && shouldIncludeTrafego },
      { onSuccess: ({ token }) => setRevealedToken(token), onError: (error) => toast.error(error.message) },
    );

  return (
    <section id="external-ai" className="rounded-[22px] bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-panel">
          <Plug className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold">IA externa (Claude Code, ChatGPT e outras)</h3>
          <p className="text-sm text-muted-foreground">
            A IA lê o Kit da Marca, o calendário e os horários livres, e cria rascunhos que entram na Caixa de criações do Planner. Ela também revisa, aprova, programa e publica, monta os fluxos de atendimento do FlowAstro e lê e lança contas no Financeiro, sempre com as suas permissões e pedindo sua confirmação antes de publicar ou ligar.
          </p>
        </div>
      </div>

      <OAuthConnectPanel />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="rounded-2xl bg-panel p-4">
          <p className="text-sm font-semibold">Chave de acesso (Claude Code, Codex e rotinas)</p>
          <p className="mt-1 mb-3 text-xs text-muted-foreground">Para IA que roda no seu computador ou sem navegador. Você escolhe as empresas da chave.</p>
          <p className="mb-2 text-xs text-muted-foreground">Nome da chave</p>
          <Input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} className="h-9 rounded-full" />
          <p className="mt-3 mb-2 text-xs text-muted-foreground">Empresas que a IA pode acessar</p>
          <div className="flex flex-wrap gap-2">
            {creatableClients.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => toggleOrganization(client.id)}
                className={cn("rounded-full px-3 py-1.5 text-sm", organizationIds.includes(client.id) ? "bg-foreground font-semibold text-background" : "bg-card")}
              >
                {client.name}
              </button>
            ))}
          </div>
          {canIncludeTrafego && (
            <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl bg-card p-3">
              <input
                type="checkbox"
                checked={shouldIncludeTrafego}
                onChange={(event) => setShouldIncludeTrafego(event.target.checked)}
                className="mt-0.5 size-4 accent-current"
              />
              <span className="text-sm">
                <span className="font-medium">Incluir ferramentas do trafeGO (equipe)</span>
                <span className="block text-xs text-muted-foreground">
                  A IA lê os pedidos do trafeGO de todas as empresas, envia recomendações para o cliente aprovar e vincula
                  campanhas. Não mexe na Meta nem em dinheiro. Entregue esta chave só a quem é da equipe.
                </span>
              </span>
            </label>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-guide={GUIDE_ANCHORS.externalAiGenerateKey.id}
              disabled={createToken.isPending || organizationIds.length === 0 || label.trim().length < 2}
              onClick={generate}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-40"
            >
              <KeyRound className="size-4" /> {createToken.isPending ? "Gerando…" : "Gerar chave"}
            </button>
            <a href="/skills/orbita-planner/SKILL.md" download className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <Download className="size-4" /> Baixar a skill orbita-planner
            </a>
            <a href="/skills/orbita-planner/orbita-remotion.zip" download className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <Clapperboard className="size-4" /> Baixar modelos de vídeo (Remotion)
            </a>
          </div>
          {revealedToken && (
            <div className="mt-4 rounded-xl bg-warning/10 p-3">
              <p className="text-sm font-semibold">Copie agora: a chave não aparece de novo.</p>
              <p className="mt-1 text-xs text-muted-foreground">No terminal, adicione o ÓRBITA ao Claude Code:</p>
              <CopyBlock text={buildClaudeCommand(revealedToken)} />
              <p className="mt-2 text-xs text-muted-foreground">Depois peça, por exemplo: “use o ÓRBITA para criar 3 posts desta semana para {creatableClients.find((client) => organizationIds.includes(client.id))?.name ?? "o cliente"}”.</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-panel p-4">
          <p className="mb-2 text-sm font-semibold">Chaves ativas</p>
          {tokens.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma chave ainda.</p>}
          <div className="space-y-2">
            {tokens.map((token) => (
              <div key={token.id} className="flex items-center gap-2 rounded-xl bg-card p-2.5">
                <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {token.label}
                    {!token.scopes.includes("flowastro") && (
                      <span title="Chave criada antes do FlowAstro no MCP: crie uma nova para montar fluxos" className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        sem FlowAstro
                      </span>
                    )}
                    {token.scopes.includes("flowastro") && !token.scopes.includes("financeiro") && (
                      <span title="Chave criada antes do Financeiro no MCP: crie uma nova para ler e lançar contas" className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        sem Financeiro
                      </span>
                    )}
                    {token.scopes.includes("trafego") && (
                      <span className="rounded-full bg-info/15 px-1.5 py-0.5 text-[10px] font-semibold text-info">trafeGO</span>
                    )}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {token.tokenPrefix}… · {token.organizationNames.join(", ")} ·{" "}
                    {token.lastUsedAt ? `usada ${formatDistanceToNow(new Date(token.lastUsedAt), { locale: ptBR, addSuffix: true })}` : "nunca usada"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revokeToken.mutate({ tokenId: token.id }, { onSuccess: () => toast.success("Chave revogada."), onError: (error) => toast.error(error.message) })}
                  className="rounded-full bg-panel px-2.5 py-1 text-xs text-destructive"
                >
                  Revogar
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
