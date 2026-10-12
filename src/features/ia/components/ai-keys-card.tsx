"use client";

import Link from "next/link";
import { CheckIcon, KeyRoundIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AiOverview } from "./ai-company-panel";
import { AiKeyScopeToggles } from "./ai-key-scope-toggles";

// "Qual IA a sua empresa usa?" (spec 0093, RF-12): a IA da plataforma ou a chave da empresa, com o
// botão de cadastrar a chave e, para cada chave salva, onde ela funciona. Nenhuma chave é desligada,
// apagada ou movida aqui (D-4): o cadastro abre o mesmo formulário de Satélites.

export type AiKeyPlatform = "OPENAI" | "GEMINI" | "ANTHROPIC";

const PROVIDERS: { provider: string; platform: AiKeyPlatform; label: string }[] = [
  { provider: "openai", platform: "OPENAI", label: "OpenAI" },
  { provider: "google", platform: "GEMINI", label: "Gemini" },
  { provider: "anthropic", platform: "ANTHROPIC", label: "Anthropic" },
];

function appsOf(rows: AiOverview["rows"]): string {
  return [...new Set(rows.map((row) => row.app))].join(", ");
}

export function AiKeysCard({ overview, canManage, onConnect }: { overview: AiOverview; canManage: boolean; onConnect: (platform: AiKeyPlatform) => void }) {
  const hasOwnKey = overview.keys.company.length + overview.keys.funnels.length > 0 || overview.keys.hasPlannerKey;

  return (
    <div className="border-t px-5 py-5">
      <h3 className="text-lg font-semibold">Qual IA a sua empresa usa?</h3>
      <p className="mb-4 text-sm text-muted-foreground">Vale para atendimento, ligações, Astro e automações.</p>

      <div className="grid gap-3 md:grid-cols-2">
        <div className={cn("rounded-2xl border-2 p-4", !hasOwnKey && "border-info")}>
          <p className="flex items-center gap-2 font-semibold">
            IA da plataforma
            {!hasOwnKey && <span className="rounded-full bg-info/15 px-2 py-0.5 text-[11px] font-medium text-info">em uso</span>}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Já vem ligada, sem cadastro. Modelo básico. Você paga em Stars, conforme usa.</p>
          {hasOwnKey && <p className="mt-2 text-xs text-muted-foreground">Continua valendo nos recursos que ainda não usam a sua chave.</p>}
        </div>

        <div className={cn("rounded-2xl border-2 p-4", hasOwnKey && "border-info")}>
          <p className="flex items-center gap-2 font-semibold">
            Minha própria chave
            {hasOwnKey && <span className="rounded-full bg-info/15 px-2 py-0.5 text-[11px] font-medium text-info">em uso</span>}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Você escolhe o modelo e paga o provedor direto. Alguns recursos ainda cobram Stars mesmo assim: a lista completa mostra quais.</p>

          <div className="mt-3 space-y-2">
            {PROVIDERS.map(({ provider, platform, label }) => {
              const savedKey = overview.keys.company.find((key) => key.provider === provider);
              const rowsOnThisKey = overview.rows.filter((row) => row.keySource === "company" && row.provider === provider);
              const rowsStillOnPlatform = overview.rows.filter((row) => row.provider === provider && row.keySource === "platform" && !row.followsRule);
              return (
                <div key={provider} className="rounded-xl bg-muted/50 px-3 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    {savedKey ? <CheckIcon className="size-4 shrink-0 text-success" /> : <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" />}
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {label}
                      {savedKey && <span className="font-normal text-muted-foreground"> · final {savedKey.last4}</span>}
                    </span>
                    {canManage && (
                      <Button type="button" size="sm" variant={savedKey ? "outline" : "default"} className="rounded-full" onClick={() => onConnect(platform)}>
                        {savedKey ? (
                          "Trocar"
                        ) : (
                          <>
                            <PlusIcon className="size-3.5" />
                            Cadastrar chave
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  {savedKey && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Funciona em:</span> {rowsOnThisKey.length > 0 ? appsOf(rowsOnThisKey) : "nenhum recurso ainda"}
                      {rowsStillOnPlatform.length > 0 && <> · Ainda na IA da plataforma: {appsOf(rowsStillOnPlatform)}</>}
                    </p>
                  )}
                  {savedKey && <AiKeyScopeToggles overview={overview} provider={provider} canManage={canManage} />}
                </div>
              );
            })}
          </div>

          {(overview.keys.funnels.length > 0 || overview.keys.hasPlannerKey) && (
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Chaves guardadas fora de Satélites (continuam valendo)</p>
              {overview.keys.funnels.map((funnelKey) => (
                <p key={funnelKey.trackingId}>
                  Funil {funnelKey.trackingName}
                  {funnelKey.last4 ? ` · final ${funnelKey.last4}` : ""} · Funciona em: atendimento deste funil ·{" "}
                  <Link href={`/tracking/${funnelKey.trackingId}/settings?tab=chatbot-ia&iaTab=model`} className="font-medium text-primary hover:underline">
                    Abrir
                  </Link>
                </p>
              ))}
              {overview.keys.hasPlannerKey && <p>Planner · chave Anthropic · Funciona em: Marca, orçamento e evento por imagem, quando a plataforma não tem chave.</p>}
            </div>
          )}
          {!canManage && <p className="mt-3 text-xs text-muted-foreground">Só o dono ou um administrador cadastra a chave.</p>}
        </div>
      </div>
    </div>
  );
}
