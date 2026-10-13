"use client";

import { useState } from "react";
import { useQueryPlatformIntegrations } from "@/features/integrations/hooks/use-integrations";
import { useSavePlannerAiKey } from "../../hooks/use-planner-org-brand";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, AlertCircle, Check } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";

// ─── AI Config inline ───────────────────────────────────────────────────────
//
// Permite o usuário colar chaves de Anthropic + Ideogram direto na aba
// Branding, sem precisar ir em Settings → Integrações. Salva via
// `platformIntegrations.upsert` (Anthropic, com fallback para campo
// específico do Planner). Pra Ideogram, por enquanto, mostramos uma
// nota informando que precisa ir no Settings (o enum IntegrationPlatform
// não tem IDEOGRAM ainda — será adicionado quando habilitarmos Ideogram
// em produção).

interface IntegrationStatus {
  platform: string;
  isActive: boolean;
}

export function AIConfigSection() {
  // IMPORTANTE: `platformIntegrations.getMany` retorna `{ integrations: [...] }`
  // (wrapped) — não array direto. Chamar `.some()` no wrapper crasha o
  // componente e cascateia pro error boundary do route segment (que
  // redireciona pra `/workspaces`, daí o popup "fechar sozinho").
  const { data, isLoading } = useQueryPlatformIntegrations();
  const integrationsList: IntegrationStatus[] = (data?.integrations ??
    []) as IntegrationStatus[];

  const anthropicConfigured = integrationsList.some(
    (i) => i.platform === "ANTHROPIC" && i.isActive,
  );

  const upsert = useSavePlannerAiKey();

  const [anthropicKey, setAnthropicKey] = useState("");
  const [showAnthropicForm, setShowAnthropicForm] = useState(false);

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-info" />
          <h3 className="font-semibold text-sm">Configuração de IA</h3>
        </div>
        {anthropicConfigured ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-success/15 text-success">
            <Check className="size-3" /> IA ativa
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-warning/15 text-warning">
            <AlertCircle className="size-3" /> Não configurada
          </span>
        )}
      </div>

      {!anthropicConfigured && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          A IA (Claude) é usada pra extrair brand kit do logo, gerar resumos
          e textos brandeados. Sem ela, geração de imagem ainda funciona
          via fallback (DALL-E / Pollinations), mas a extração automática do
          logo fica indisponível.
        </p>
      )}

      {!showAnthropicForm ? (
        <Button
          size="sm"
          variant={anthropicConfigured ? "outline" : "default"}
          onClick={() => setShowAnthropicForm(true)}
          className="gap-2"
        >
          <Sparkles className="size-3.5" />
          {anthropicConfigured ? "Atualizar chave Anthropic" : "Configurar IA agora"}
        </Button>
      ) : (
        <div className="space-y-2 rounded-md bg-muted/40 p-3">
          <Label htmlFor="anthropic-key" className="text-xs">
            Chave da API Anthropic
          </Label>
          <Input
            id="anthropic-key"
            type="password"
            placeholder="sk-ant-..."
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            className="font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Cole sua chave da{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-info hover:underline font-medium"
            >
              Anthropic Console
            </a>
            . A chave fica salva criptografada apenas pra sua organização —
            nunca exibida na UI depois (campo password). Você pode trocar a
            qualquer momento.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (!anthropicKey.trim()) {
                  toast.error("Cole a chave Anthropic antes de salvar");
                  return;
                }
                upsert.mutate(
                  {
                    platform: "ANTHROPIC" as never,
                    config: { apiKey: anthropicKey.trim() },
                    isActive: true,
                  },
                  {
                    onSuccess: () => {
                      setAnthropicKey("");
                      setShowAnthropicForm(false);
                    },
                  },
                );
              }}
              disabled={upsert.isPending}
              className="gap-2"
            >
              {upsert.isPending ? (
                <OrbitaSpinner className="size-3.5 " />
              ) : (
                <Check className="size-3.5" />
              )}
              Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAnthropicForm(false);
                setAnthropicKey("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Ideogram: instrução enxuta (env var por enquanto) */}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Configurar Ideogram (gerador de imagens premium)
        </summary>
        <div className="mt-2 rounded-md bg-muted/40 p-3 space-y-2">
          <p className="text-[11px] leading-relaxed">
            O Ideogram 3.0 é o melhor modelo pra cards com tipografia legível
            (estilo Dra. Thaine). Por enquanto, a chave global é configurada
            via env var <code className="bg-background px-1 rounded">IDEOGRAM_API_KEY</code>
            {" "}no servidor. Sem isso, a UI cai pra DALL-E / Pollinations
            automaticamente — você não precisa fazer nada se quiser usar só
            esses providers.
          </p>
          <p className="text-[11px] leading-relaxed">
            Pegue uma chave grátis em{" "}
            <a
              href="https://ideogram.ai/manage-api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-info hover:underline font-medium"
            >
              ideogram.ai/manage-api
            </a>
            {" "}e adicione no seu <code className="bg-background px-1 rounded">.env.local</code>.
            Suporte a chave por-org via UI chega numa sprint futura.
          </p>
        </div>
      </details>
    </div>
  );
}
