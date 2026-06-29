"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

import { orpc } from "@/lib/orpc";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useOrgRole } from "@/hooks/use-org-role";
import { AiAgentMode } from "@/generated/prisma/enums";

const MODE_LABEL: Record<AiAgentMode, string> = {
  MANUAL: "Manual — usuário inicia",
  TRIGGER: "Trigger — sugere em eventos",
  AUTO: "Auto — executa sem perguntar",
};

/**
 * Painel "Agentes IA" em Settings. Lê todas as configs (`astro.agentConfigs.list`)
 * e permite a Owner/Admin alterar `enabled` + `mode`. Gravar via
 * `astro.agentConfigs.update` (servidor checa role).
 *
 * Knowledge bases ficam para a Sessão 3 (precisa do CRUD de KB primeiro).
 */
export function AgentsSection() {
  const { isAdmin, isMaster } = useOrgRole();
  const canEdit = isAdmin || isMaster;

  const queryClient = useQueryClient();
  const configsQuery = useQuery(orpc.astro.agentConfigs.list.queryOptions());

  const updateMutation = useMutation(
    orpc.astro.agentConfigs.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.astro.agentConfigs.list.queryOptions().queryKey,
        });
        toast.success("Configuração atualizada.");
      },
      onError: (e) => toast.error(e.message ?? "Falha ao atualizar"),
    }),
  );

  const configs = useMemo(
    () => configsQuery.data?.configs ?? [],
    [configsQuery.data],
  );

  return (
    <div className="space-y-3">
      {!canEdit && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
          Você está em modo somente-leitura. Apenas Owner/Admin pode alterar
          configurações de agentes IA.
        </div>
      )}

      {configsQuery.isLoading && (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      )}

      {configs.map((c) => (
        <Card key={c.agentKey} className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Sparkles className="size-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{c.displayName}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.description}
                  </p>
                </div>
                <Switch
                  checked={c.enabled}
                  disabled={!canEdit || updateMutation.isPending}
                  onCheckedChange={(v) =>
                    updateMutation.mutate({
                      agentKey: c.agentKey as never,
                      enabled: v,
                      mode: c.mode,
                      knowledgeIds: c.knowledgeIds,
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pl-8">
            <label className="text-xs text-muted-foreground w-20">
              Modo
            </label>
            <Select
              value={c.mode}
              disabled={!canEdit || !c.enabled || updateMutation.isPending}
              onValueChange={(v: AiAgentMode) =>
                updateMutation.mutate({
                  agentKey: c.agentKey as never,
                  enabled: c.enabled,
                  mode: v,
                  knowledgeIds: c.knowledgeIds,
                })
              }
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["MANUAL", "TRIGGER", "AUTO"] as AiAgentMode[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {MODE_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>
      ))}

      <p className="text-[11px] text-muted-foreground pt-2">
        Bases de conhecimento (PDF/planilhas/docs) virão na próxima entrega.
      </p>
    </div>
  );
}
