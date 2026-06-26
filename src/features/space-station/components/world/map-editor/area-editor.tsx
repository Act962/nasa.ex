"use client";

/**
 * AreaEditor — Ferramenta de editor de área (estilo WorkAdventure).
 * Permite desenhar retângulos no mapa com tipo + propriedades (silent, exit, meeting, etc).
 */

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  SquareDashed,
  Crosshair,
  ChevronDown,
  ChevronRight,
  Upload,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { AREA_TYPE_META, type AreaType, type MapArea } from "../../../types";

/** Fallback pra áreas com tipo legado (ex: removido). */
function getMeta(type: AreaType) {
  return (
    AREA_TYPE_META[type] ?? {
      label: type as string,
      emoji: "🏷️",
      color: "#94a3b8",
      description: "",
    }
  );
}

interface Props {
  areas:    MapArea[];
  onChange: (next: MapArea[]) => void;
}

export function AreaEditor({ areas, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawingType, setDrawingType] = useState<AreaType | null>(null);
  const [drawingExpanded, setDrawingExpanded] = useState(true);

  // Ao ativar o tipo de desenho, avisa o Phaser
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("space-station:area-draw-mode", {
      detail: { type: drawingType },
    }));
  }, [drawingType]);

  // Recebe retângulo desenhado pelo Phaser
  useEffect(() => {
    const onDrawn = (e: Event) => {
      const d = (e as CustomEvent).detail as { type: AreaType; x: number; y: number; w: number; h: number };
      const meta = getMeta(d.type);
      const n = areas.filter(a => a.type === d.type).length + 1;
      const area: MapArea = {
        id:    `area-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name:  `${meta.label} ${n}`,
        type:  d.type,
        x: d.x, y: d.y, w: d.w, h: d.h,
        color: meta.color,
      };
      onChange([...areas, area]);
      setSelectedId(area.id);
      setDrawingType(null);
    };
    const onSelected = (e: Event) => {
      const { id } = (e as CustomEvent).detail as { id: string | null };
      setSelectedId(id);
    };
    const onMoved = (e: Event) => {
      const d = (e as CustomEvent).detail as { id: string; x: number; y: number; w?: number; h?: number };
      onChange(areas.map(a => a.id === d.id ? {
        ...a, x: d.x, y: d.y,
        ...(d.w !== undefined ? { w: d.w } : {}),
        ...(d.h !== undefined ? { h: d.h } : {}),
      } : a));
    };
    window.addEventListener("space-station:area-drawn",    onDrawn);
    window.addEventListener("space-station:area-selected", onSelected);
    window.addEventListener("space-station:area-moved",    onMoved);
    return () => {
      window.removeEventListener("space-station:area-drawn",    onDrawn);
      window.removeEventListener("space-station:area-selected", onSelected);
      window.removeEventListener("space-station:area-moved",    onMoved);
    };
  }, [areas, onChange]);

  const selected = selectedId ? areas.find(a => a.id === selectedId) ?? null : null;

  function remove(id: string) {
    onChange(areas.filter(a => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function update(patch: Partial<MapArea>) {
    if (!selected) return;
    onChange(areas.map(a => a.id === selected.id ? { ...a, ...patch } : a));
  }

  function updateProps(patch: Partial<NonNullable<MapArea["props"]>>) {
    if (!selected) return;
    onChange(areas.map(a => a.id === selected.id ? { ...a, props: { ...(a.props ?? {}), ...patch } } : a));
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-5 pt-5 pb-3 border-b border-white/5">
        <h2 className="text-lg font-semibold text-white tracking-tight">Ferramenta de áreas</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Desenhe zonas no mapa — silenciosa, saída, reunião, áudio…
        </p>
      </div>

      {/* Tipo de área para desenhar — colapsável */}
      <div className="px-5 pt-3 pb-2">
        <button
          type="button"
          onClick={() => setDrawingExpanded((v) => !v)}
          className="w-full flex items-center justify-between gap-2 mb-2 group"
          title={drawingExpanded ? "Recolher" : "Expandir"}
        >
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold group-hover:text-slate-300 transition-colors">
            Desenhar área
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors">
            {drawingType && !drawingExpanded && (
              <span className="text-indigo-400 normal-case">
                {getMeta(drawingType).emoji} {getMeta(drawingType).label}
              </span>
            )}
            {drawingExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        </button>

        {drawingExpanded && (
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(AREA_TYPE_META) as AreaType[]).map((t) => {
              const m = getMeta(t);
              const active = drawingType === t;
              return (
                <button
                  key={t}
                  onClick={() => setDrawingType(active ? null : t)}
                  className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg border transition-colors ${
                    active
                      ? "border-indigo-400/60 bg-indigo-500/10 text-indigo-200"
                      : "border-white/5 hover:border-white/20 hover:bg-white/5 text-slate-300"
                  }`}
                  title={m.description}
                >
                  <span className="text-base leading-none">{m.emoji}</span>
                  <span className="text-[10px] font-medium leading-tight">{m.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {drawingType && (
          <div className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded-md bg-indigo-500/10 border border-indigo-400/20 text-[11px] text-indigo-300">
            <Crosshair className="h-3 w-3 animate-pulse" />
            <span>Arraste no mapa para desenhar • Esc para cancelar</span>
          </div>
        )}
      </div>

      {/* Lista de áreas */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center justify-between">
          <span>Áreas do mapa</span>
          <span className="text-slate-400 tabular-nums normal-case">{areas.length}</span>
        </div>

        {areas.length === 0 && !drawingType && (
          <div className="flex flex-col items-center py-10 text-slate-500">
            <SquareDashed className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Nenhuma área criada</p>
            <p className="text-xs text-slate-600 mt-1">Escolha um tipo acima e desenhe no mapa</p>
          </div>
        )}

        {areas.map((a) => {
          const m = getMeta(a.type);
          const isSelected = selectedId === a.id;
          return (
            <div
              key={a.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedId(a.id);
                window.dispatchEvent(new CustomEvent("space-station:area-focus", { detail: { id: a.id } }));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedId(a.id);
                  window.dispatchEvent(new CustomEvent("space-station:area-focus", { detail: { id: a.id } }));
                }
              }}
              className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left border transition-colors cursor-pointer ${
                isSelected
                  ? "border-indigo-400/40 bg-indigo-500/10"
                  : "border-transparent hover:bg-white/5"
              }`}
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-sm"
                style={{ backgroundColor: (a.color ?? m.color) + "33", border: `1px solid ${a.color ?? m.color}` }}
              >
                {m.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white truncate">{a.name}</div>
                <div className="text-[10px] text-slate-500 tabular-nums">
                  {Math.round(a.w)}×{Math.round(a.h)}px
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); remove(a.id); }}
                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Inspetor — altura limitada + scroll próprio pra não invadir o footer
          "Fechar/Salvar" do MapEditor pai. Antes ficava expandindo livre e
          empurrava as configurações de áreas grandes (ex: info com mensagem
          longa, website com URL) por trás dos botões fixos. */}
      {selected && (
        <div className="flex-shrink-0 border-t border-white/5 p-4 space-y-3 max-h-[45vh] overflow-y-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white flex-1 truncate">{selected.name}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ color: getMeta(selected.type).color, border: `1px solid ${getMeta(selected.type).color}66` }}>
              {getMeta(selected.type).label}
            </span>
          </div>

          <Field label="Nome">
            <input
              value={selected.name}
              onChange={(e) => update({ name: e.target.value })}
              className="w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </Field>

          {/* Props por tipo */}
          {(selected.type === "exit") && (
            <Field label="Station de destino (nick)">
              <input
                value={selected.props?.targetNick ?? ""}
                onChange={(e) => updateProps({ targetNick: e.target.value })}
                placeholder="ex: nasa-hq"
                className="w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </Field>
          )}
          {(selected.type === "website") && (
            <Field label="URL">
              <input
                value={selected.props?.url ?? ""}
                onChange={(e) => updateProps({ url: e.target.value })}
                placeholder="https://..."
                className="w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </Field>
          )}
          {(selected.type === "play-audio") && (
            <Field label="URL do áudio">
              <input
                value={selected.props?.audioUrl ?? ""}
                onChange={(e) => updateProps({ audioUrl: e.target.value })}
                placeholder="https://.../som.mp3"
                className="w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </Field>
          )}
          {(selected.type === "meeting") && (
            <Field label="Nome da sala">
              <input
                value={selected.props?.roomName ?? ""}
                onChange={(e) => updateProps({ roomName: e.target.value })}
                placeholder="ex: sala-direcao"
                className="w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </Field>
          )}
          {(selected.type === "info") && (
            <Field label="Mensagem">
              <textarea
                value={selected.props?.message ?? ""}
                onChange={(e) => updateProps({ message: e.target.value })}
                rows={2}
                className="w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </Field>
          )}
          {(selected.type === "credits") && (
            <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-3 space-y-2">
              <p className="text-[11px] text-orange-300 leading-relaxed">
                Ao entrar nesta área, os visitantes verão o painel de créditos e atribuições
                <span className="font-semibold"> CC BY-SA 3.0 / 4.0 </span>
                dos assets utilizados (personagens Pipoya/LPC, objetos LimeZu, etc.).
              </p>
              <Field label="Nota adicional (opcional)">
                <textarea
                  value={selected.props?.message ?? ""}
                  onChange={(e) => updateProps({ message: e.target.value })}
                  rows={2}
                  placeholder="Ex: Este espaço usa assets sob CC BY-SA 3.0"
                  className="w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </Field>
            </div>
          )}

          {/* ─── Funções NASA ──────────────────────────────────────────── */}
          {selected.type === "n-box" && (
            <NBoxItemPicker
              value={selected.props?.nboxItemId ?? ""}
              onChange={(id) => updateProps({ nboxItemId: id })}
            />
          )}

          {selected.type === "agendamento" && (
            <>
              <AgendaPicker
                value={selected.props?.agendaSlug ?? ""}
                onChange={(slug) => updateProps({ agendaSlug: slug })}
              />
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={selected.props?.openInNewTab ?? false}
                  onChange={(e) =>
                    updateProps({ openInNewTab: e.target.checked })
                  }
                />
                Abrir em nova aba (somente owner / criador do mundo)
              </label>
            </>
          )}

          {selected.type === "demanda" && (
            <WorkspacePicker
              value={selected.props?.workspaceId ?? ""}
              onChange={(id) => updateProps({ workspaceId: id })}
            />
          )}

          {selected.type === "balcao" && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 space-y-2">
              <p className="text-[11px] text-rose-300 leading-relaxed">
                Ao entrar, o avatar visitante aparece <strong>sendo atendido</strong>{" "}
                pelo avatar do owner — comunicação fictícia exibida no chat,
                com o nome do lead acima do avatar e a posição/quantidade
                em espera.
              </p>
              <TrackingPicker
                value={selected.props?.trackingId ?? ""}
                onChange={(id) => updateProps({ trackingId: id })}
              />
            </div>
          )}

          {selected.type === "profile" && (
            <div className="rounded-lg bg-teal-500/10 border border-teal-500/20 p-3 space-y-2">
              <p className="text-[11px] text-teal-300 leading-relaxed">
                Mostra os dados do avatar (Nome, E-mail, Função, Cargo e
                demais infos do perfil em <em>Geral</em>).
              </p>
              <Field label="Modo de ativação">
                <select
                  value={selected.props?.profileMode ?? "click"}
                  onChange={(e) =>
                    updateProps({
                      profileMode: e.target.value as "self" | "click",
                    })
                  }
                  className="w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="click">Clicar em outro player</option>
                  <option value="self">Mostrar próprio perfil</option>
                </select>
              </Field>
            </div>
          )}

          {selected.type === "prateleira" && (
            <Field label="ID do catálogo">
              <input
                value={selected.props?.productCatalogId ?? ""}
                onChange={(e) =>
                  updateProps({ productCatalogId: e.target.value })
                }
                placeholder="ID da vitrine de produtos"
                className="w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </Field>
          )}

          {selected.type === "auditorio" && (
            <>
              <CoursePicker
                label="Curso exibido ao entrar"
                value={selected.props?.courseId ?? ""}
                onChange={(id) => updateProps({ courseId: id })}
              />
              <Field label="Capacidade">
                <input
                  type="number"
                  min={2}
                  max={500}
                  value={selected.props?.capacity ?? 50}
                  onChange={(e) =>
                    updateProps({
                      capacity: Math.max(
                        2,
                        Math.min(500, parseInt(e.target.value) || 50),
                      ),
                    })
                  }
                  className="w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 tabular-nums"
                />
              </Field>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Ao entrar, o link do curso aparece na tela. O visitante pode
                comprar diretamente.
              </p>
            </>
          )}

          {selected.type === "nasa-route" && (
            <CoursePicker
              label="Produto / curso à venda"
              value={selected.props?.courseId ?? ""}
              onChange={(id) => updateProps({ courseId: id })}
            />
          )}

          {selected.type === "formulario" && (
            <>
              <FormPicker
                value={selected.props?.formId ?? ""}
                onChange={(id) => updateProps({ formId: id })}
              />
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={selected.props?.openInNewTab ?? false}
                  onChange={(e) =>
                    updateProps({ openInNewTab: e.target.checked })
                  }
                />
                Abrir em nova aba (somente owner / criador do mundo)
              </label>
            </>
          )}

          {selected.type === "rede-social" && (
            <Field label="Rota interna">
              <input
                value={selected.props?.socialRoute ?? "/social"}
                onChange={(e) => updateProps({ socialRoute: e.target.value })}
                placeholder="/social"
                className="w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </Field>
          )}

          {selected.type === "imagem-link" && (
            <>
              <ImageUploader
                value={selected.props?.imageUrl ?? ""}
                onChange={(url) => updateProps({ imageUrl: url })}
              />
              <Field label="URL de destino (clique)">
                <input
                  value={selected.props?.url ?? ""}
                  onChange={(e) => updateProps({ url: e.target.value })}
                  placeholder="https://ifood.com.br/..."
                  className="w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </Field>
              <Field label="Texto alternativo (alt)">
                <input
                  value={selected.props?.imageAlt ?? ""}
                  onChange={(e) => updateProps({ imageAlt: e.target.value })}
                  placeholder="ex: iFood"
                  className="w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </Field>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={selected.props?.openInNewTab !== false}
                  onChange={(e) =>
                    updateProps({ openInNewTab: e.target.checked })
                  }
                />
                Abrir em nova aba
              </label>
            </>
          )}

          {/* TODO runtime: o comportamento de cada Função NASA ao o player
              entrar/clicar é wireado em world-scene.ts (handleAreaEnter /
              handleAreaClick). Como cada função integra com módulos
              diferentes (N-Box files, Workspace actions, Tracking, NASA
              Route, formulários, etc.), a implementação é incremental. */}

          <div className="grid grid-cols-2 gap-2">
            <Field label="Largura">
              <input
                type="number"
                value={Math.round(selected.w)}
                onChange={(e) => update({ w: Math.max(16, parseInt(e.target.value) || 16) })}
                className="w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 tabular-nums"
              />
            </Field>
            <Field label="Altura">
              <input
                type="number"
                value={Math.round(selected.h)}
                onChange={(e) => update({ h: Math.max(16, parseInt(e.target.value) || 16) })}
                className="w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 tabular-nums"
              />
            </Field>
          </div>
        </div>
      )}

      {!selected && areas.length > 0 && (
        <div className="border-t border-white/5 px-4 py-3 text-[11px] text-slate-500 flex items-center gap-1.5">
          <Plus className="h-3 w-3" />
          Selecione uma área para editar propriedades
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">{label}</span>
      {children}
    </label>
  );
}

/* ─── Pickers (dropdowns) ─────────────────────────────────────────────── */

const SELECT_CLASS =
  "w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500";

function AgendaPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (slug: string) => void;
}) {
  const { data, isLoading } = useQuery({
    ...orpc.agenda.getMany.queryOptions({}),
    retry: false,
  });
  const agendas = (((data as { agendas?: Array<{ id: string; name: string; slug: string; isActive: boolean }> })?.agendas) ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
  }>;
  return (
    <Field label="Agenda">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLASS}
        disabled={isLoading}
      >
        <option value="">— Selecione uma agenda —</option>
        {agendas.map((a) => (
          <option key={a.id} value={a.slug}>
            {a.name} {a.isActive ? "" : "(inativa)"}
          </option>
        ))}
      </select>
      {!isLoading && agendas.length === 0 && (
        <p className="mt-1 text-[10px] text-slate-500">
          Nenhuma agenda cadastrada — crie uma em /agendas.
        </p>
      )}
    </Field>
  );
}

function WorkspacePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { data, isLoading } = useQuery({
    ...orpc.workspace.list.queryOptions({ input: {} }),
    retry: false,
  });
  const workspaces = ((data as { workspaces?: Array<{ id: string; name: string }> })
    ?.workspaces ?? []) as Array<{ id: string; name: string }>;
  return (
    <Field label="Workspace">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLASS}
        disabled={isLoading}
      >
        <option value="">— Selecione um workspace —</option>
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

function TrackingPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { data, isLoading } = useQuery({
    ...orpc.tracking.list.queryOptions({}),
    retry: false,
  });
  // tracking.list retorna o array diretamente (não { trackings })
  const trackings = (Array.isArray(data) ? data : []) as Array<{
    id: string;
    name: string;
  }>;
  return (
    <Field label="Tracking (funil)">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLASS}
        disabled={isLoading}
      >
        <option value="">— Selecione um tracking —</option>
        {trackings.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

function FormPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { data, isLoading } = useQuery({
    ...orpc.form.list.queryOptions({ input: {} }),
    retry: false,
  });
  const forms = ((data as { forms?: Array<{ id: string; name?: string; title?: string }> })
    ?.forms ?? []) as Array<{ id: string; name?: string; title?: string }>;
  return (
    <Field label="Formulário">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLASS}
        disabled={isLoading}
      >
        <option value="">— Selecione um formulário —</option>
        {forms.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name || f.title || `Formulário ${f.id.slice(0, 6)}`}
          </option>
        ))}
      </select>
      {!isLoading && forms.length === 0 && (
        <p className="mt-1 text-[10px] text-slate-500">
          Nenhum formulário disponível — crie em /forms.
        </p>
      )}
    </Field>
  );
}

function CoursePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const { data, isLoading } = useQuery({
    ...orpc.nasaRoute.creatorListCourses.queryOptions({}),
    retry: false,
  });
  const courses = ((data as { courses?: Array<{ id: string; title?: string; name?: string }> })
    ?.courses ?? []) as Array<{ id: string; title?: string; name?: string }>;
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLASS}
        disabled={isLoading}
      >
        <option value="">— Selecione um curso —</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title || c.name || `Curso ${c.id.slice(0, 6)}`}
          </option>
        ))}
      </select>
      {!isLoading && courses.length === 0 && (
        <p className="mt-1 text-[10px] text-slate-500">
          Nenhum curso cadastrado — crie um em NASA Route.
        </p>
      )}
    </Field>
  );
}

function NBoxItemPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { data, isLoading } = useQuery({
    ...orpc.nbox.items.getMany.queryOptions({ input: {} }),
    retry: false,
  });
  const items = ((data as { items?: Array<{ id: string; name: string }> })
    ?.items ?? []) as Array<{ id: string; name: string }>;
  return (
    <Field label="Documento / arquivo (N-Box)">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLASS}
        disabled={isLoading}
      >
        <option value="">— Selecione um arquivo —</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
      {!isLoading && items.length === 0 && (
        <p className="mt-1 text-[10px] text-slate-500">
          Nenhum arquivo no N-Box — faça upload pra autorizar a exibição.
        </p>
      )}
    </Field>
  );
}

/* ─── Image uploader ─────────────────────────────────────────────────── */

function ImageUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload-local", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!data.url) throw new Error(data.error ?? "Sem URL retornada");
      onChange(data.url);
    } catch (e) {
      setError(`Falha ao enviar: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Field label="Imagem">
      <div className="space-y-2">
        {value && (
          <div className="relative rounded-md overflow-hidden border border-white/10 bg-slate-900/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Preview"
              className="w-full h-24 object-contain"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex-1 px-2 py-1.5 rounded-md border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-xs text-indigo-200 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            {uploading
              ? "Enviando..."
              : value
                ? "Trocar imagem"
                : "Selecionar imagem"}
          </button>
          {value && !uploading && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="px-2 py-1.5 rounded-md border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-xs text-red-200"
              title="Remover imagem"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
        {error && <p className="text-[10px] text-red-400">{error}</p>}
      </div>
    </Field>
  );
}
