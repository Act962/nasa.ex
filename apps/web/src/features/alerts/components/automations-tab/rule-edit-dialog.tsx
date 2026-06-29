"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getParamFields } from "@/features/alerts/lib/param-fields";
import {
  ParamForm,
  buildParamsForApi,
  deriveTrackingHint,
} from "./param-form";

interface CatalogEvent {
  key: string;
  label: string;
  description: string;
  appKey: string;
  audienceOptions: string[];
  supportsCooldown: boolean;
}

interface Rule {
  id: string;
  name: string;
  description: string | null;
  eventType: string;
  params: unknown;
  severity: string;
  audience: unknown;
  channels: unknown;
  isActive: boolean;
  cooldownMinutes: number | null;
}

interface Props {
  open: boolean;
  mode: "new" | "edit";
  eventType?: string;
  ruleId?: string;
  catalogEvents: CatalogEvent[];
  existingRules: Rule[];
  onClose: () => void;
  onSaved: () => void;
}

const AUDIENCE_LABELS: Record<string, string> = {
  lead_responsible: "Responsável do lead",
  action_participants: "Participantes da ação",
  org_supervisors: "Supervisores da org",
  org_admins: "Admins da org",
  user: "Só pra mim",
  whole_org: "Toda a empresa",
};

const SEVERITY_LABELS: Record<string, string> = {
  info: "Info — sininho",
  warning: "Atenção — toast",
  critical: "Crítico — popup",
};

/**
 * Diálogo de criação/edição de AlertRule.
 *
 * Modo "new" (eventType pré-selecionado):
 *   - User só preenche: nome, audiência, severity, params do evento, cooldown.
 *
 * Modo "edit" (ruleId):
 *   - Pré-carrega valores existentes.
 */
export function RuleEditDialog({
  open,
  mode,
  eventType,
  ruleId,
  catalogEvents,
  existingRules,
  onClose,
  onSaved,
}: Props) {
  const editingRule = useMemo(
    () => (mode === "edit" && ruleId ? existingRules.find((r) => r.id === ruleId) : undefined),
    [mode, ruleId, existingRules],
  );

  const resolvedEventType = editingRule?.eventType ?? eventType ?? "";
  const eventDef = useMemo(
    () => catalogEvents.find((e) => e.key === resolvedEventType),
    [catalogEvents, resolvedEventType],
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"info" | "warning" | "critical">(
    "warning",
  );
  const [audienceKind, setAudienceKind] = useState<string>("user");
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({});
  const [cooldown, setCooldown] = useState<string>("");

  // Specs dos params do evento — derivam o form dinamicamente.
  const fields = useMemo(
    () => getParamFields(resolvedEventType),
    [resolvedEventType],
  );

  // Pré-carrega editor options pra reconstruir o trackingHint quando edita
  // uma regra existente (ex: statusId → tracking dono).
  const optsQuery = useQuery(orpc.alerts.editorOptions.queryOptions());

  // Hidrata estado quando muda o item editado / cria.
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && editingRule) {
      setName(editingRule.name);
      setDescription(editingRule.description ?? "");
      const sev = editingRule.severity;
      setSeverity(
        sev === "info" || sev === "warning" || sev === "critical"
          ? sev
          : "warning",
      );
      const aud = editingRule.audience as { kind?: string } | null;
      setAudienceKind(aud?.kind ?? "user");
      const existingParams =
        (editingRule.params as Record<string, unknown>) ?? {};
      // Reconstrói _trackingHint pra cascata começar pré-selecionada
      const hint = deriveTrackingHint(existingParams, optsQuery.data);
      setParamValues(
        hint ? { ...existingParams, _trackingHint: hint } : existingParams,
      );
      setCooldown(
        editingRule.cooldownMinutes !== null
          ? String(editingRule.cooldownMinutes)
          : "",
      );
    } else if (mode === "new" && eventDef) {
      setName(eventDef.label);
      setDescription("");
      setSeverity("warning");
      setAudienceKind(eventDef.audienceOptions[0] ?? "user");
      // Defaults dos fields (pre-popula number defaults)
      const defaults: Record<string, unknown> = {};
      for (const f of getParamFields(eventDef.key)) {
        if (f.defaultValue !== undefined) defaults[f.paramKey] = f.defaultValue;
      }
      setParamValues(defaults);
      setCooldown("");
    }
  }, [open, mode, editingRule, eventDef, optsQuery.data]);

  const createMut = useMutation(
    orpc.alerts.createRule.mutationOptions({ onSuccess: onSaved }),
  );
  const updateMut = useMutation(
    orpc.alerts.updateRule.mutationOptions({ onSuccess: onSaved }),
  );

  const submitting = createMut.isPending || updateMut.isPending;
  const error =
    (createMut.error?.message as string | undefined) ??
    (updateMut.error?.message as string | undefined);

  const handleSave = () => {
    if (!eventDef) return;
    const params = buildParamsForApi(paramValues, fields);
    // Validação client-side: required fields
    for (const f of fields) {
      if (f.required && (params[f.paramKey] === undefined || params[f.paramKey] === "")) {
        alert(`Campo obrigatório vazio: ${f.label}`);
        return;
      }
    }

    const audience = { kind: audienceKind as "user" };
    const cooldownMin = cooldown.trim() ? Number(cooldown) : null;
    if (cooldownMin !== null && (Number.isNaN(cooldownMin) || cooldownMin < 1)) {
      alert("Cooldown precisa ser um número >= 1.");
      return;
    }

    if (mode === "new") {
      createMut.mutate({
        name: name.trim(),
        description: description.trim() || undefined,
        eventType: eventDef.key,
        params,
        severity,
        audience,
        channels: ["in_app"],
        cooldownMinutes: cooldownMin ?? undefined,
      });
    } else if (editingRule) {
      updateMut.mutate({
        id: editingRule.id,
        name: name.trim(),
        description: description.trim() || null,
        params,
        severity,
        audience,
        cooldownMinutes: cooldownMin,
      });
    }
  };

  if (!eventDef) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Evento desconhecido</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esse tipo de alerta não está no catálogo.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "new" ? "Nova regra" : "Editar regra"}
          </DialogTitle>
          <DialogDescription>
            Evento: <strong>{eventDef.label}</strong> — {eventDef.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="rule-name" className="text-xs">
              Nome da regra
            </Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Lead parado 2 dias"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="rule-desc" className="text-xs">
              Descrição (opcional)
            </Label>
            <Input
              id="rule-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Observação interna"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rule-severity" className="text-xs">
                Severidade
              </Label>
              <select
                id="rule-severity"
                value={severity}
                onChange={(e) =>
                  setSeverity(e.target.value as "info" | "warning" | "critical")
                }
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
              >
                {(["info", "warning", "critical"] as const).map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="rule-audience" className="text-xs">
                Quem recebe
              </Label>
              <select
                id="rule-audience"
                value={audienceKind}
                onChange={(e) => setAudienceKind(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
              >
                {eventDef.audienceOptions.map((k) => (
                  <option key={k} value={k}>
                    {AUDIENCE_LABELS[k] ?? k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Parâmetros</Label>
            <div className="mt-1.5 rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
              <ParamForm
                fields={fields}
                values={paramValues}
                onChange={setParamValues}
              />
            </div>
          </div>

          {eventDef.supportsCooldown && (
            <div>
              <Label htmlFor="rule-cooldown" className="text-xs">
                Cooldown em minutos (opcional)
              </Label>
              <Input
                id="rule-cooldown"
                type="number"
                min={1}
                max={1440}
                value={cooldown}
                onChange={(e) => setCooldown(e.target.value)}
                placeholder="Ex: 60 (anti-spam)"
                className="mt-1"
              />
            </div>
          )}

          {error && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={submitting || !name.trim()}>
            {submitting
              ? "Salvando…"
              : mode === "new"
                ? "Criar regra"
                : "Salvar mudanças"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
