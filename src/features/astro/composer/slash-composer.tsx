"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Send,
  X,
  ArrowRight,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import { orpc } from "@/lib/orpc";
import { useDebouncedValue } from "@/hooks/use-debounced";
import { useComposerStore } from "./use-composer-store";
import {
  APPS_BY_VERB,
  CHIP_STYLE,
  VERBS,
  findTemplate,
  type ChipCategory,
  type ChipValue,
  type EntityKind,
  type StepDef,
  type VerbId,
} from "./templates";

/**
 * Slash Composer — input estruturado com chips coloridos.
 *
 * Fluxo:
 *   1. User clica "Adicionar comando" ou aperta "/" → picker de VERBO
 *   2. Pick verbo → chip azul + picker de APP
 *   3. Pick app → chip violeta + carrega template + começa loop de steps
 *   4. Cada step abre um sub-picker apropriado:
 *      - entity → autocomplete async via orpc.astro.searchEntities
 *      - enum   → lista fixa
 *      - date   → input free-text + sugestões ("amanhã", "hoje 14h", "16/05 10h")
 *      - param  → input free-text
 *   5. Submit quando todos required preenchidos → buildPrompt(values)
 *      → onSubmit(text) — quem chama envia ao Astro chat.
 *
 * Cada chip pode ser removido (X) pra editar — composer recalcula o próximo
 * step a partir do estado.
 */

export interface DirectIntentPayload {
  /**
   * Intent type:
   *   - "create_workflow": cria 1 workflow + 1 node prefilled.
   *     payload.nodeType obrigatório. payload.agentMode = "true" opcional.
   *   - "apply_preset": aplica blueprint inteiro (agent-presets builder).
   *     payload.presetSlug obrigatório.
   */
  type: "create_workflow" | "apply_preset";
  values: Record<string, ChipValue>;
  /** Payload fixo do template (nodeType, agentMode, presetSlug). */
  payload?: Record<string, string>;
}

export interface SlashComposerProps {
  onSubmit: (prompt: string) => void;
  /**
   * Quando o template tem `directIntent`, o composer chama essa função ao
   * invés de `onSubmit(prompt)`. Use pra ações que têm API própria (ex:
   * criar Workflow). Se não fornecido, cai no fluxo de prompt normal.
   */
  onDirectIntent?: (intent: DirectIntentPayload) => void;
  loading?: boolean;
  className?: string;
}

interface ComposerState {
  verb: VerbId | null;
  app: string | null;
  values: Record<string, ChipValue>;
}

const initialState: ComposerState = { verb: null, app: null, values: {} };

export function SlashComposer({
  onSubmit,
  onDirectIntent,
  loading,
  className,
}: SlashComposerProps) {
  const [state, setState] = useState<ComposerState>(initialState);

  const template = useMemo(
    () => (state.verb && state.app ? findTemplate(state.verb, state.app) : null),
    [state.verb, state.app],
  );

  // Próximo step pendente — primeiro que ainda não tem valor
  const nextStep = useMemo<StepDef | null>(() => {
    if (!template) return null;
    return template.steps.find((s) => !state.values[s.key]) ?? null;
  }, [template, state.values]);

  // Pode submeter quando todos os required têm valor
  const canSubmit = useMemo(() => {
    if (!template) return false;
    return template.steps
      .filter((s) => s.required)
      .every((s) => state.values[s.key]);
  }, [template, state.values]);

  const reset = () => setState(initialState);

  const pushRecent = useComposerStore((s) => s.pushRecent);

  const handleSubmit = () => {
    if (!template || !canSubmit) return;

    // Caminho 1: template tem directIntent → chama handler local (cria
    // Workflow direto pela API, sem passar pelo Astro chat).
    if (template.directIntent && onDirectIntent) {
      onDirectIntent({
        type: template.directIntent.type,
        values: { ...state.values },
        payload: template.directIntent.payload,
      });
      reset();
      return;
    }

    // Caminho 2: normal → constrói prompt e envia pro Astro
    const prompt = template.buildPrompt(state.values);
    pushRecent({ prompt, label: template.title });
    onSubmit(prompt);
    reset();
  };

  // Remove o chip de um step (volta a perguntar). Mantém os chips
  // anteriores no fluxo — se remover o verbo, reseta tudo.
  const removeChip = (key: "verb" | "app" | string) => {
    if (key === "verb") return reset();
    if (key === "app") return setState((s) => ({ ...s, app: null, values: {} }));
    setState((s) => {
      const v = { ...s.values };
      delete v[key];
      return { ...s, values: v };
    });
  };

  const setValue = (key: string, value: ChipValue) => {
    setState((s) => ({ ...s, values: { ...s.values, [key]: value } }));
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-card/40 p-3 space-y-3",
        className,
      )}
    >
      {/* Linha de chips */}
      <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]">
        {state.verb && (
          <Chip
            category="verb"
            label={labelForVerb(state.verb)}
            onRemove={() => removeChip("verb")}
          />
        )}
        {state.app && (
          <Chip
            category="app"
            label={labelForApp(state.verb, state.app)}
            onRemove={() => removeChip("app")}
          />
        )}
        {template?.steps.map((step) => {
          const value = state.values[step.key];
          if (!value) return null;
          return (
            <Chip
              key={step.key}
              category={step.category}
              label={value.display}
              onRemove={() => removeChip(step.key)}
            />
          );
        })}
        {!state.verb && (
          <p className="text-xs text-muted-foreground px-1">
            Escolha um verbo abaixo
          </p>
        )}
      </div>

      {/* Picker do próximo step */}
      <StepPicker
        state={state}
        template={template}
        nextStep={nextStep}
        onSelectVerb={(v) => setState({ verb: v, app: null, values: {} })}
        onSelectApp={(a) => setState((s) => ({ ...s, app: a, values: {} }))}
        onSetValue={setValue}
        onSubmitPrompt={(prompt) => {
          // 1-click pra reenviar recente
          pushRecent({ prompt, label: prompt.slice(0, 32) });
          onSubmit(prompt);
        }}
      />

      {/* Action bar */}
      {state.verb && (
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-line">
          {template && (
            <p className="text-[11px] text-muted-foreground truncate">
              Vou: <span className="text-muted-foreground">{previewPrompt(template, state.values)}</span>
            </p>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={reset}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              disabled={loading}
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                canSubmit && !loading
                  ? "bg-info hover:bg-info text-white"
                  : "bg-card text-muted-foreground cursor-not-allowed",
              )}
            >
              {loading ? (
                <OrbitaSpinner className="size-3.5 " />
              ) : (
                <Send className="size-3.5" />
              )}
              Enviar pro Astro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Chip ────────────────────────────────────────────────────────────────────

function Chip({
  category,
  label,
  onRemove,
}: {
  category: ChipCategory;
  label: string;
  onRemove: () => void;
}) {
  const s = CHIP_STYLE[category];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium",
        s.bg,
        s.border,
        s.text,
      )}
    >
      <span className="font-mono">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="opacity-60 hover:opacity-100"
        aria-label="Remover chip"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

// ─── Picker do próximo step (decide o tipo) ──────────────────────────────────

function StepPicker(props: {
  state: ComposerState;
  template: ReturnType<typeof findTemplate> | null;
  nextStep: StepDef | null;
  onSelectVerb: (v: VerbId) => void;
  onSelectApp: (a: string) => void;
  onSetValue: (key: string, value: ChipValue) => void;
  onSubmitPrompt?: (prompt: string) => void;
}) {
  const { state, template, nextStep, onSelectVerb, onSelectApp, onSetValue } =
    props;
  const recent = useComposerStore((s) => s.recent);

  // 1) Sem verbo ainda → picker de verbo + recentes ABAIXO
  if (!state.verb) {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Verbos
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {VERBS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelectVerb(v.id)}
                className="flex items-center gap-2 rounded-lg border border-line bg-card/60 px-2.5 py-1.5 text-xs text-foreground hover:border-info/50 hover:bg-card transition-colors"
              >
                <span className="font-mono">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
        {recent.length > 0 && props.onSubmitPrompt && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Recentes
            </p>
            <div className="flex flex-wrap gap-1">
              {recent.slice(0, 4).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => props.onSubmitPrompt?.(r.prompt)}
                  title={r.prompt}
                  className="inline-flex items-center gap-1 rounded-md border border-info/30 bg-info/10 text-info px-2 py-1 text-[11px] hover:bg-info/20"
                >
                  <span className="truncate max-w-[200px]">{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2) Verbo escolhido, sem app → picker de apps válidos
  if (!state.app) {
    const apps = APPS_BY_VERB[state.verb] ?? [];
    // Agrupa por `group` quando aplicável (verbo "automatizar" tem 21 apps
    // divididos em Gatilhos / Ações / Adicionar Lead no App)
    const hasGroups = apps.some((a) => "group" in a && a.group);
    // Labels e ordem dos grupos. Modo Agente IA aparece DEPOIS dos legacy
    // (gatilhos/ações/apps clássicos) pra não confundir users novos —
    // quem precisa de IA já sabe onde procurar.
    const groupLabels: Record<string, string> = {
      trigger: "Gatilhos",
      execution: "Ações",
      "send-to-app": "Apps",
      "agent-trigger": "🤖 Modo Agente IA · Gatilhos",
      "agent-logic": "🤖 Modo Agente IA · Lógica",
      "agent-ai": "🤖 Modo Agente IA · Decisão & Geração",
      "agent-data": "🤖 Modo Agente IA · Dados",
      "agent-app": "🤖 Modo Agente IA · Apps",
      "agent-preset": "🚀 Presets prontos (workflow inteiro)",
    };
    const groupOrder = [
      "trigger",
      "execution",
      "send-to-app",
      "agent-trigger",
      "agent-logic",
      "agent-ai",
      "agent-data",
      "agent-app",
      "agent-preset",
    ];
    type AppItem = (typeof apps)[number];
    const grouped = hasGroups
      ? apps.reduce<Record<string, AppItem[]>>((acc, a) => {
          const g = ("group" in a && a.group) || "outros";
          acc[g] = acc[g] ?? [];
          acc[g].push(a);
          return acc;
        }, {})
      : null;
    // Reordena pra obedecer `groupOrder` (legacy primeiro, IA depois,
    // presets por último). Grupos desconhecidos vão pro final.
    const groupedOrdered = grouped
      ? Object.fromEntries(
          [...groupOrder, ...Object.keys(grouped).filter((g) => !groupOrder.includes(g))]
            .filter((g) => grouped[g])
            .map((g) => [g, grouped[g]]),
        )
      : null;

    return (
      <div>
        <p className="text-[11px] text-muted-foreground mb-1.5">O que você quer?</p>
        {groupedOrdered ? (
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {Object.entries(groupedOrdered).map(([g, list]) => (
              <div key={g}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  {groupLabels[g] ?? g}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {list.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onSelectApp(a.id)}
                      className="flex items-center gap-2 rounded-lg border border-line bg-card/60 px-2.5 py-1.5 text-xs text-foreground hover:border-info/50 hover:bg-card transition-colors text-left"
                    >
                      <span className="truncate">{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {apps.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onSelectApp(a.id)}
                className="flex items-center gap-2 rounded-lg border border-line bg-card/60 px-2.5 py-1.5 text-xs text-foreground hover:border-info/50 hover:bg-card transition-colors"
              >
                <span className="font-mono">{a.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 3) App escolhido — ou template não existe (combinação não suportada)
  //    ou termina (sem nextStep, todos preenchidos)
  if (!template) {
    return (
      <p className="text-xs text-warning">
        Essa combinação ainda não está disponível.
      </p>
    );
  }
  if (!nextStep) {
    return (
      <p className="text-xs text-success">
        Pronto pra enviar — clique "Enviar pro Astro" abaixo.
      </p>
    );
  }

  // 4) Step ativo
  return (
    <StepInput
      step={nextStep}
      onComplete={(value) => onSetValue(nextStep.key, value)}
    />
  );
}

// ─── Input por tipo de step ──────────────────────────────────────────────────

function StepInput({
  step,
  onComplete,
}: {
  step: StepDef;
  onComplete: (value: ChipValue) => void;
}) {
  if (step.category === "entity" && step.entityKind) {
    return (
      <EntityPickerInput
        step={step}
        entityKind={step.entityKind}
        onComplete={onComplete}
      />
    );
  }
  if (step.category === "enum" && step.options) {
    return (
      <EnumPickerInput
        step={step}
        options={step.options}
        onComplete={onComplete}
      />
    );
  }
  // date + param compartilham UI de free-text com placeholder
  return <FreeTextInput step={step} onComplete={onComplete} />;
}

// ─── Free text (param + date) ────────────────────────────────────────────────

function FreeTextInput({
  step,
  onComplete,
}: {
  step: StepDef;
  onComplete: (value: ChipValue) => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleConfirm = () => {
    const v = value.trim();
    if (!v) return;
    onComplete({ display: v, raw: v });
    setValue("");
  };

  // Sugestões rápidas pra date
  const dateSuggestions = step.category === "date"
    ? ["amanhã", "hoje 14h", "sexta 10h", "16/05 10h"]
    : [];

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-muted-foreground">{step.prompt ?? step.label}</p>
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleConfirm();
            }
          }}
          placeholder={step.placeholder ?? ""}
          className="flex-1 rounded-md border border-line bg-card px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info"
        />
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!value.trim()}
          className="rounded-md bg-info/70 hover:bg-info text-white px-2 py-1.5 text-xs disabled:opacity-50"
        >
          <ArrowRight className="size-3.5" />
        </button>
      </div>
      {dateSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {dateSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onComplete({ display: s, raw: s })}
              className="text-[10px] rounded-md border border-warning/30 bg-warning/10 text-warning px-1.5 py-0.5 hover:bg-warning/20"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {!step.required && (
        <button
          type="button"
          onClick={() => onComplete({ display: "—", raw: "" })}
          className="text-[10px] text-muted-foreground hover:text-muted-foreground"
        >
          Pular (opcional)
        </button>
      )}
    </div>
  );
}

// ─── Enum picker ─────────────────────────────────────────────────────────────

function EnumPickerInput({
  step,
  options,
  onComplete,
}: {
  step: StepDef;
  options: Array<{ value: string; label: string }>;
  onComplete: (value: ChipValue) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-muted-foreground">{step.prompt ?? step.label}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() =>
              onComplete({ display: opt.label, raw: opt.value })
            }
            className="text-left rounded-md border border-success/30 bg-success/10 text-success px-2 py-1.5 text-xs hover:bg-success/20 transition-colors"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Entity picker (async autocomplete) ──────────────────────────────────────

function EntityPickerInput({
  step,
  entityKind,
  onComplete,
}: {
  step: StepDef;
  entityKind: EntityKind;
  onComplete: (value: ChipValue) => void;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 150);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { data, isFetching } = useQuery(
    orpc.astro.searchEntities.queryOptions({
      input: { entityType: entityKind, query: debounced, limit: 8 },
    }),
  );

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-muted-foreground">{step.prompt ?? step.label}</p>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Buscar ${entityKind}…`}
          className="w-full rounded-md border border-line bg-card pl-7 pr-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info"
        />
        {isFetching && (
          <OrbitaSpinner className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground " />
        )}
      </div>
      <div className="max-h-44 overflow-y-auto space-y-0.5">
        {data?.matches.length === 0 && !query && (
          <p className="text-[11px] text-muted-foreground px-1 py-1">
            Nada encontrado. Tente outro termo
            {step.required ? "" : " ou pule abaixo"}.
          </p>
        )}
        {data?.matches.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() =>
              onComplete({
                display: m.label,
                raw: m.id,
                entityId: m.id,
                entityLabel: m.label,
              })
            }
            className="w-full text-left rounded-md border border-info/20 bg-info/5 hover:bg-info/15 px-2 py-1 text-xs text-info"
          >
            <span className="block truncate font-medium">{m.label}</span>
            {m.hint && (
              <span className="block truncate text-[10px] text-info/60">
                {m.hint}
              </span>
            )}
          </button>
        ))}
        {/* Opção de criar nova entidade quando step.creatable + query digitado
            e sem match exato. raw recebe prefixo __create__: pro handler
            saber que precisa criar primeiro. */}
        {step.creatable &&
          query.trim().length > 0 &&
          !data?.matches.some(
            (m) => m.label.toLowerCase() === query.trim().toLowerCase(),
          ) && (
            <button
              type="button"
              onClick={() => {
                const name = query.trim();
                onComplete({
                  display: `${name} (nova)`,
                  raw: `__create__:${name}`,
                  entityLabel: name,
                });
              }}
              className="w-full text-left rounded-md border border-success/30 bg-success/10 hover:bg-success/20 px-2 py-1 text-xs text-success"
            >
              <span className="block truncate font-medium">
                + Criar &ldquo;{query.trim()}&rdquo;
              </span>
              <span className="block truncate text-[10px] text-success/70">
                vira um novo {entityKind === "workflow_folder" ? "pasta" : entityKind}
              </span>
            </button>
          )}
      </div>
      {!step.required && (
        <button
          type="button"
          onClick={() => onComplete({ display: "—", raw: "" })}
          className="text-[10px] text-muted-foreground hover:text-muted-foreground"
        >
          Pular (opcional)
        </button>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function labelForVerb(verb: VerbId): string {
  return VERBS.find((v) => v.id === verb)?.label ?? verb;
}

function labelForApp(verb: VerbId | null, app: string): string {
  if (!verb) return app;
  return APPS_BY_VERB[verb]?.find((a) => a.id === app)?.label ?? app;
}

function previewPrompt(
  template: NonNullable<ReturnType<typeof findTemplate>>,
  values: Record<string, ChipValue>,
): string {
  try {
    return template.buildPrompt(values);
  } catch {
    return template.title;
  }
}
