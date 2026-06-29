"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import type { AppKey } from "@/features/alerts/lib/alert-catalog";
import { AppTabs } from "./app-tabs";
import { CatalogCards } from "./catalog-cards";
import { RulesList } from "./rules-list";
import { RuleEditDialog } from "./rule-edit-dialog";
import { LeadsWithAlerts } from "./leads-with-alerts";

/**
 * Aba "Automações" dentro de `/settings/notifications`.
 *
 * Layout vertical:
 *   1. Tabs por App (Tracking | Workspace | Agenda | …).
 *   2. Catálogo de tipos de alerta do app selecionado (cards clicáveis).
 *      Click num card abre o `RuleEditDialog` em modo "criar" pré-preenchido.
 *   3. Lista das regras existentes do user / org (toggle, editar, excluir).
 *
 * Estado central:
 *   - `activeApp`: AppKey selecionado.
 *   - `editingRuleId`: null = fechado, "new" = criar, "<id>" = editar.
 *   - `prefillEventType`: usado quando user clica num card pra criar.
 */
export function AutomationsTab() {
  const qc = useQueryClient();
  const [activeApp, setActiveApp] = useState<AppKey>("tracking");
  const [editing, setEditing] = useState<
    { mode: "new"; eventType: string } | { mode: "edit"; ruleId: string } | null
  >(null);

  const catalogQuery = useQuery(orpc.alerts.catalog.queryOptions());
  const rulesQuery = useQuery(
    orpc.alerts.listRules.queryOptions({
      input: { appKey: activeApp, includeInactive: true },
    }),
  );

  const apps = catalogQuery.data?.apps ?? [];
  const events = useMemo(
    () =>
      (catalogQuery.data?.events ?? []).filter((e) => e.appKey === activeApp),
    [catalogQuery.data, activeApp],
  );
  const rules = rulesQuery.data?.rules ?? [];

  const toggleMut = useMutation(
    orpc.alerts.updateRule.mutationOptions({
      onSuccess: () => qc.invalidateQueries({
        queryKey: orpc.alerts.listRules.queryKey({ input: {} }),
      }),
    }),
  );
  const deleteMut = useMutation(
    orpc.alerts.deleteRule.mutationOptions({
      onSuccess: () => qc.invalidateQueries({
        queryKey: orpc.alerts.listRules.queryKey({ input: {} }),
      }),
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Automações & Alertas</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Crie regras pra ser avisado quando algo acontecer nos seus apps.
          Cada app tem tipos de alerta pré-prontos — clique pra criar.
        </p>
      </div>

      <AppTabs
        apps={apps}
        activeApp={activeApp}
        onChange={setActiveApp}
      />

      <CatalogCards
        events={events}
        loading={catalogQuery.isLoading}
        onPick={(eventType) => setEditing({ mode: "new", eventType })}
      />

      <RulesList
        rules={rules}
        loading={rulesQuery.isLoading}
        catalogEvents={catalogQuery.data?.events ?? []}
        onToggle={(rule) =>
          toggleMut.mutate({ id: rule.id, isActive: !rule.isActive })
        }
        onEdit={(rule) => setEditing({ mode: "edit", ruleId: rule.id })}
        onDelete={(rule) => {
          if (confirm(`Apagar a regra "${rule.name}"?`)) {
            deleteMut.mutate({ id: rule.id });
          }
        }}
      />

      {/* Drill-down: leads que dispararam alertas no app ativo.
          Renderiza-se sozinho se houver pelo menos 1 lead com alerta
          (caso contrário some — evita ruído em apps sem histórico). */}
      <LeadsWithAlerts appKey={activeApp} />

      <RuleEditDialog
        open={editing !== null}
        mode={editing?.mode ?? "new"}
        eventType={
          editing?.mode === "new" ? editing.eventType : undefined
        }
        ruleId={editing?.mode === "edit" ? editing.ruleId : undefined}
        catalogEvents={catalogQuery.data?.events ?? []}
        existingRules={rules}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          qc.invalidateQueries({
        queryKey: orpc.alerts.listRules.queryKey({ input: {} }),
      });
        }}
      />
    </div>
  );
}
