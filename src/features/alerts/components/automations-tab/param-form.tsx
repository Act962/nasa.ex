"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FieldSpec } from "@/features/alerts/lib/param-fields";

interface ParamFormProps {
  fields: FieldSpec[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

/**
 * Renderiza inputs UI pra cada FieldSpec do evento selecionado.
 *
 * Substitui o textarea de JSON cru. Cada `kind` mapeia pra um input
 * específico (pickers cascadeados, number, enum, etc).
 *
 * Pickers de entidade (tracking/status/tag/form/workspace) consomem
 * `alerts.editorOptions` (1 call cacheada — TanStack Query dedupe).
 */
export function ParamForm({ fields, values, onChange }: ParamFormProps) {
  const optsQuery = useQuery(orpc.alerts.editorOptions.queryOptions());

  // Selected tracking (se houver) — usado pra cascata status/tag.
  // Convenção: o paramKey `_trackingHint` é um helper SÓ-UI (não persiste).
  const selectedTrackingId =
    typeof values._trackingHint === "string" ? values._trackingHint : null;

  const setField = (key: string, value: unknown) => {
    onChange({ ...values, [key]: value });
  };

  // Pick tracking + reset campos cascateados (statusId/tagId) em UMA única
  // chamada — senão duas chamadas a setField na mesma callback usam o mesmo
  // snapshot de `values` e a segunda sobrescreve a primeira (stale state).
  const handlePickTracking = (trackingId: string) => {
    onChange({
      ...values,
      _trackingHint: trackingId,
      statusId: "",
      tagId: "",
    });
  };

  if (fields.length === 0) {
    return (
      <div className="text-xs text-zinc-500 italic px-1 py-2">
        Esse evento não tem parâmetros configuráveis.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <FieldRow
          key={f.paramKey}
          spec={f}
          value={values[f.paramKey]}
          selectedTrackingId={selectedTrackingId}
          options={optsQuery.data}
          loading={optsQuery.isLoading}
          onChange={(v) => setField(f.paramKey, v)}
          onPickTracking={handlePickTracking}
        />
      ))}
    </div>
  );
}

interface EditorOptions {
  trackings: {
    id: string;
    name: string;
    statuses: { id: string; name: string; color: string | null }[];
  }[];
  tags: {
    id: string;
    name: string;
    color: string | null;
    trackingId: string | null;
  }[];
  agendas: { id: string; name: string; slug: string }[];
  forms: { id: string; name: string }[];
  workspaces: { id: string; name: string }[];
}

function FieldRow({
  spec,
  value,
  selectedTrackingId,
  options,
  loading,
  onChange,
  onPickTracking,
}: {
  spec: FieldSpec;
  value: unknown;
  selectedTrackingId: string | null;
  options: EditorOptions | undefined;
  loading: boolean;
  onChange: (v: unknown) => void;
  onPickTracking: (trackingId: string) => void;
}) {
  const label = (
    <Label className="text-xs">
      {spec.label}
      {spec.required && <span className="text-rose-400 ml-1">*</span>}
    </Label>
  );

  switch (spec.kind) {
    case "number": {
      const v = typeof value === "number" ? value : undefined;
      return (
        <div>
          {label}
          <div className="mt-1 flex items-center gap-2">
            <Input
              type="number"
              min={spec.min}
              max={spec.max}
              value={v ?? ""}
              placeholder={
                spec.defaultValue !== undefined
                  ? String(spec.defaultValue)
                  : ""
              }
              onChange={(e) => {
                const n = e.target.value === "" ? null : Number(e.target.value);
                onChange(n);
              }}
              className="max-w-[160px]"
            />
            {spec.unitLabel && (
              <span className="text-xs text-zinc-500">{spec.unitLabel}</span>
            )}
          </div>
          {spec.hint && (
            <p className="text-[11px] text-zinc-500 mt-1">{spec.hint}</p>
          )}
        </div>
      );
    }

    case "text": {
      const v = typeof value === "string" ? value : "";
      return (
        <div>
          {label}
          <Input
            value={v}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1"
          />
          {spec.hint && (
            <p className="text-[11px] text-zinc-500 mt-1">{spec.hint}</p>
          )}
        </div>
      );
    }

    case "select-tracking-status": {
      // Cascata: tracking → status. _trackingHint controla a primeira; statusId é o real param.
      const tracking = options?.trackings.find(
        (t) => t.id === selectedTrackingId,
      );
      const v = typeof value === "string" ? value : "";
      return (
        <div>
          {label}
          <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={selectedTrackingId ?? ""}
              onChange={(e) => onPickTracking(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
              disabled={loading}
            >
              <option value="">Tracking…</option>
              {options?.trackings.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              value={v}
              onChange={(e) => onChange(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
              disabled={!tracking || loading}
            >
              <option value="">
                {tracking ? "Status…" : "Escolha tracking primeiro"}
              </option>
              {tracking?.statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {spec.hint && (
            <p className="text-[11px] text-zinc-500 mt-1">{spec.hint}</p>
          )}
        </div>
      );
    }

    case "select-tag": {
      const v = typeof value === "string" ? value : "";
      // Filtra tags: do tracking selecionado + as org-wide (trackingId=null).
      const tags = (options?.tags ?? []).filter(
        (t) =>
          t.trackingId === null ||
          (selectedTrackingId && t.trackingId === selectedTrackingId),
      );
      return (
        <div>
          {label}
          <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={selectedTrackingId ?? ""}
              onChange={(e) => onPickTracking(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
              disabled={loading}
            >
              <option value="">Tracking (opcional)</option>
              {options?.trackings.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              value={v}
              onChange={(e) => onChange(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
              disabled={loading}
            >
              <option value="">Tag…</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.trackingId === null ? " (global)" : ""}
                </option>
              ))}
            </select>
          </div>
          {spec.hint && (
            <p className="text-[11px] text-zinc-500 mt-1">{spec.hint}</p>
          )}
        </div>
      );
    }

    case "select-tracking": {
      const v = typeof value === "string" ? value : "";
      return (
        <div>
          {label}
          <select
            value={v}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
            disabled={loading}
          >
            <option value="">{spec.required ? "Tracking…" : "Qualquer"}</option>
            {options?.trackings.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {spec.hint && (
            <p className="text-[11px] text-zinc-500 mt-1">{spec.hint}</p>
          )}
        </div>
      );
    }

    case "select-form": {
      const v = typeof value === "string" ? value : "";
      return (
        <div>
          {label}
          <select
            value={v}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
            disabled={loading}
          >
            <option value="">{spec.required ? "Formulário…" : "Qualquer formulário"}</option>
            {options?.forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          {spec.hint && (
            <p className="text-[11px] text-zinc-500 mt-1">{spec.hint}</p>
          )}
        </div>
      );
    }

    case "select-workspace": {
      const v = typeof value === "string" ? value : "";
      return (
        <div>
          {label}
          <select
            value={v}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
            disabled={loading}
          >
            <option value="">{spec.required ? "Workspace…" : "Qualquer workspace"}</option>
            {options?.workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          {spec.hint && (
            <p className="text-[11px] text-zinc-500 mt-1">{spec.hint}</p>
          )}
        </div>
      );
    }

    case "select-agenda": {
      const v = typeof value === "string" ? value : "";
      return (
        <div>
          {label}
          <select
            value={v}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
            disabled={loading}
          >
            <option value="">{spec.required ? "Agenda…" : "Qualquer agenda"}</option>
            {options?.agendas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {spec.hint && (
            <p className="text-[11px] text-zinc-500 mt-1">{spec.hint}</p>
          )}
        </div>
      );
    }

    case "select-enum": {
      const v = typeof value === "string" ? value : "";
      return (
        <div>
          {label}
          <select
            value={v}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
          >
            <option value="">
              {spec.required ? "Escolha…" : "Qualquer"}
            </option>
            {spec.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {spec.hint && (
            <p className="text-[11px] text-zinc-500 mt-1">{spec.hint}</p>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}

/**
 * Helper: limpa as values pra mandar pra API.
 * - Remove `_trackingHint` (campo só-UI, não vai pro backend).
 * - Remove strings vazias (campos opcionais não preenchidos).
 * - Mantém zero como número válido (importante pra threshold=0 etc).
 */
export function buildParamsForApi(
  values: Record<string, unknown>,
  fields: FieldSpec[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.paramKey];
    if (v === undefined || v === null || v === "") continue;
    out[f.paramKey] = v;
  }
  return out;
}

/**
 * Helper: dado um params já gravado (ex: regra existente), reconstrói
 * `_trackingHint` quando possível pra UI cascading começar pré-selecionada.
 *
 * - statusId → busca tracking dono do status.
 * - tagId → busca tracking dono da tag.
 */
export function deriveTrackingHint(
  params: Record<string, unknown>,
  options: EditorOptions | undefined,
): string | null {
  if (!options) return null;

  if (typeof params.statusId === "string") {
    for (const t of options.trackings) {
      if (t.statuses.some((s) => s.id === params.statusId)) return t.id;
    }
  }
  if (typeof params.tagId === "string") {
    const tag = options.tags.find((t) => t.id === params.tagId);
    if (tag?.trackingId) return tag.trackingId;
  }
  return null;
}

