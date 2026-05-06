"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowRight, Bot, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { MetaMcpAuthorizedMembers } from "./meta-mcp-authorized-members";

const EXAMPLES = [
  '"Quais campanhas estão com CPA alto?"',
  '"Pausa as campanhas com ROAS abaixo de 2"',
  '"Cria uma campanha pra Black Friday R$ 100/dia"',
];

/**
 * Seção "Astro + IA" do card Meta em /integrations.
 *
 * Estados:
 *  - Meta não conectado → não renderiza
 *  - MCP não habilitado + canManage → discovery banner
 *  - MCP não habilitado + sem canManage → mensagem "peça ao master"
 *  - MCP habilitado + canManage → settings expandido (3 sub-tabs)
 *  - MCP habilitado + autorizado → status compacto + link "como usar"
 *  - MCP habilitado + não autorizado → "você não foi autorizado"
 */
export function MetaMcpSection() {
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useQuery(
    orpc.metaMcp.getStatus.queryOptions({}),
  );
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [tab, setTab] = useState<"general" | "ops" | "members">("general");

  const enableMutation = useMutation({
    ...orpc.metaMcp.enable.mutationOptions(),
    onSuccess: () => {
      toast.success("Astro Meta Ads habilitado!");
      setWelcomeOpen(true);
      queryClient.invalidateQueries({ queryKey: ["metaMcp"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const disableMutation = useMutation({
    ...orpc.metaMcp.disable.mutationOptions(),
    onSuccess: () => {
      toast.success("Astro Meta Ads desabilitado");
      queryClient.invalidateQueries({ queryKey: ["metaMcp"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }
  if (!status?.metaConnected) return null;

  const { mcpEnabled, currentUser, config, authorizedMembersCount } = status;

  // Banner "Habilitar" quando MCP não ativo
  if (!mcpEnabled) {
    if (!currentUser.canManage) {
      return (
        <Card className="border-dashed">
          <CardContent className="p-4 flex items-start gap-3">
            <Bot className="size-5 text-muted-foreground/60 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-medium text-muted-foreground">
                Astro Meta Ads não habilitado nesta organização
              </p>
              <p className="text-muted-foreground/70 mt-0.5">
                Peça ao Master ou Moderador pra habilitar em Integrações.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }
    return (
      <>
        <Card className="border-primary/40 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Sparkles className="size-3" /> NOVIDADE
              </Badge>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <Bot className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold tracking-tight">
                  Astro Meta Ads
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Gerencie suas campanhas em linguagem natural. Exemplos do que você
                  pode pedir:
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {EXAMPLES.map((e) => (
                    <li key={e} className="flex items-start gap-1.5">
                      <span className="text-primary">·</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => enableMutation.mutate({})}
                disabled={enableMutation.isPending}
                className="gap-2"
              >
                <CheckCircle2 className="size-3.5" />
                {enableMutation.isPending
                  ? "Habilitando..."
                  : "Habilitar — 1 clique"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                asChild
              >
                <a
                  href="https://docs.nasaex.com/meta-mcp"
                  target="_blank"
                  rel="noreferrer"
                >
                  Saiba mais
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <WelcomeModal open={welcomeOpen} onOpenChange={setWelcomeOpen} />
      </>
    );
  }

  // MCP habilitado — mostra status + (settings se canManage)
  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Bot className="size-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  Astro Meta Ads
                  <Badge
                    variant="outline"
                    className="text-[10px] gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                  >
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Ativo
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {authorizedMembersCount}{" "}
                  {authorizedMembersCount === 1 ? "membro" : "membros"} autorizado
                  {authorizedMembersCount === 1 ? "" : "s"} ·{" "}
                  {config?.mcpAllowedOps?.join(", ") ?? "leitura"}
                </p>
              </div>
            </div>
            {!currentUser.authorized && (
              <Badge variant="outline" className="text-[10px] shrink-0">
                Você não foi autorizado
              </Badge>
            )}
          </div>

          {currentUser.canManage && (
            <>
              <div className="flex gap-1 border-b">
                {[
                  { id: "general", label: "Geral" },
                  { id: "ops", label: "Operações permitidas" },
                  { id: "members", label: "Membros autorizados" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id as typeof tab)}
                    className={`px-3 py-1.5 text-xs border-b-2 transition-colors ${
                      tab === t.id
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {tab === "general" && (
                <GeneralTab
                  status={status}
                  onDisable={() => disableMutation.mutate({})}
                  disablePending={disableMutation.isPending}
                />
              )}
              {tab === "ops" && <OperationsTab status={status} />}
              {tab === "members" && <MetaMcpAuthorizedMembers />}
            </>
          )}
        </CardContent>
      </Card>

      <WelcomeModal open={welcomeOpen} onOpenChange={setWelcomeOpen} />
    </>
  );
}

// ── Tab Geral ─────────────────────────────────────────────────────────────

function GeneralTab({
  status,
  onDisable,
  disablePending,
}: {
  status: NonNullable<ReturnType<typeof useStatusQuery>>;
  onDisable: () => void;
  disablePending: boolean;
}) {
  const config = status.config;
  if (!config) return null;
  return (
    <div className="space-y-3 pt-2">
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-muted-foreground">Modelo IA padrão</p>
          <p className="font-medium tabular-nums">{config.mcpDefaultModel}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Orçamento máx por campanha</p>
          <p className="font-medium tabular-nums">
            R$ {config.mcpMaxBudgetPerCampaign.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Habilitado em</p>
          <p className="font-medium">
            {config.mcpEnabledAt
              ? new Date(config.mcpEnabledAt).toLocaleDateString("pt-BR")
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Membros autorizados</p>
          <p className="font-medium">{status.authorizedMembersCount}</p>
        </div>
      </div>
      <div className="flex justify-end pt-2 border-t">
        <Button
          size="sm"
          variant="ghost"
          onClick={onDisable}
          disabled={disablePending}
          className="text-destructive hover:text-destructive text-xs"
        >
          {disablePending ? "Desabilitando..." : "Desabilitar Astro Meta Ads"}
        </Button>
      </div>
    </div>
  );
}

// ── Tab Operações ──────────────────────────────────────────────────────────

function OperationsTab({
  status,
}: {
  status: NonNullable<ReturnType<typeof useStatusQuery>>;
}) {
  const queryClient = useQueryClient();
  const config = status.config;
  const allowed = config?.mcpAllowedOps ?? [];

  const updateMutation = useMutation({
    ...orpc.metaMcp.updateSettings.mutationOptions(),
    onSuccess: () => {
      toast.success("Operações atualizadas");
      queryClient.invalidateQueries({ queryKey: ["metaMcp"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const ops = [
    { id: "read", label: "Leitura (listar campanhas, insights, diagnósticos)" },
    { id: "pause", label: "Pausar campanhas" },
    { id: "resume", label: "Retomar campanhas pausadas" },
    { id: "create", label: "Criar campanhas (com confirmação)" },
    { id: "update", label: "Editar campanhas (orçamento, audiência)" },
    { id: "delete", label: "Deletar campanhas (perigoso)" },
    { id: "catalog", label: "Catálogos / feeds de produtos" },
  ] as const;

  function toggle(opId: string, checked: boolean) {
    const next = checked
      ? [...new Set([...allowed, opId])]
      : allowed.filter((o) => o !== opId);
    updateMutation.mutate({ allowedOps: next as any });
  }

  return (
    <div className="space-y-2 pt-2">
      <p className="text-xs text-muted-foreground">
        Controla o que o Astro pode fazer. Operações de escrita sempre exigem
        confirmação no chat antes de executar.
      </p>
      {ops.map((op) => {
        const isOn = allowed.includes(op.id);
        return (
          <label
            key={op.id}
            className="flex items-start gap-2 text-xs cursor-pointer hover:bg-muted/30 rounded p-1.5"
          >
            <input
              type="checkbox"
              checked={isOn}
              onChange={(e) => toggle(op.id, e.target.checked)}
              disabled={updateMutation.isPending}
              className="mt-0.5"
            />
            <span className={isOn ? "" : "text-muted-foreground"}>{op.label}</span>
          </label>
        );
      })}
    </div>
  );
}

// ── Welcome Modal ──────────────────────────────────────────────────────────

function WelcomeModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Astro Meta Ads habilitado!
          </DialogTitle>
          <DialogDescription>
            Master e Moderadores já podem usar agora. Próximos passos
            opcionais:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <NextStep
            num={1}
            title="Teste agora"
            description="Vá em Insights → Relatórios e digite no Astro: lista minhas campanhas Meta"
            href="/insights/relatorios"
            cta="Ir testar"
          />
          <NextStep
            num={2}
            title="Autorize sua equipe"
            description="Hoje só Master/Moderador podem usar. Pra liberar admins ou members específicos, abra a aba Membros autorizados."
          />
          <NextStep
            num={3}
            title="Permitir mais operações"
            description="Por padrão Astro só lê e pausa/retoma. Pra deixá-lo criar e editar, abra a aba Operações permitidas."
          />
        </div>

        <div className="flex justify-end pt-3">
          <Button onClick={() => onOpenChange(false)}>
            Entendi, começar a usar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NextStep({
  num,
  title,
  description,
  href,
  cta,
}: {
  num: number;
  title: string;
  description: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
        {num}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      {href && cta && (
        <Button asChild size="sm" variant="ghost" className="shrink-0 text-xs">
          <a href={href}>
            {cta} <ArrowRight className="size-3 ml-1" />
          </a>
        </Button>
      )}
    </div>
  );
}

// Helper só pra TS inferir o shape do status sem repetir tipo
function useStatusQuery() {
  return useQuery(orpc.metaMcp.getStatus.queryOptions({})).data;
}
