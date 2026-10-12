"use client";

import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useUpdateAiPreferences } from "@/features/ia/hooks/use-ai-resources";
import type { AiOverview } from "./ai-company-panel";

// "Funciona em" editável (spec 0093, etapa 2, RF-16): para uma chave salva em Satélites, os recursos
// que hoje só usam a IA da plataforma e que já podem passar a usar a chave da empresa. Nada vem
// ligado: cada recurso só muda quando o dono ou admin liga.

export function AiKeyScopeToggles({ overview, provider, canManage }: { overview: AiOverview; provider: string; canManage: boolean }) {
  const updatePreferences = useUpdateAiPreferences();
  const selectableRows = overview.rows.filter((row) => row.isSelectorWired && row.platformProvider === provider);
  if (selectableRows.length === 0) return null;

  const toggleResource = (resourceId: string, isOn: boolean) => {
    const current = overview.preferences.companyKeyResources;
    const companyKeyResources = isOn ? [...new Set([...current, resourceId])] : current.filter((currentId) => currentId !== resourceId);
    updatePreferences.mutate(
      { companyKeyResources, useBands: overview.preferences.useBands },
      { onError: (error) => toast.error(`Não consegui salvar: ${error.message}`) },
    );
  };

  return (
    <div className="mt-2 space-y-1.5 border-t pt-2">
      <p className="text-xs font-medium text-foreground">Usar esta chave também em</p>
      {selectableRows.map((row) => (
        <label key={row.resourceId} className="flex items-center gap-2 text-xs">
          <Switch
            checked={row.isCompanyKeyRequested}
            disabled={!canManage || updatePreferences.isPending}
            onCheckedChange={(isOn) => toggleResource(row.resourceId, isOn)}
            aria-label={`Usar a chave da empresa em ${row.label}`}
          />
          <span className="min-w-0 flex-1">
            <span className="text-foreground">{row.label}</span>
            <span className="text-muted-foreground"> · {row.app}</span>
          </span>
        </label>
      ))}
      <p className="text-[11px] text-muted-foreground">
        Ligado, o recurso roda na sua chave e você paga o provedor. Os recursos que cobram Stars continuam cobrando por enquanto, mesmo na sua chave.
      </p>
    </div>
  );
}
