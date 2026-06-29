"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Paintbrush, Eraser, PaintBucket, Undo2, Redo2,
  LayoutGrid, Pencil, Square, SquareDashed,
  BookOpen, User, Users, Lock, Globe2, Loader2, Trash2, Hand,
} from "lucide-react";
import type { TileLayer, TileCell, TileTextureKey, PlacedMapObject, WorldMapData } from "../../../types";
import { TILE_PRESETS, drawTilePreviewCanvas } from "./tile-textures";
import {
  ROOM_TEMPLATES, ROOM_CATEGORIES, getTemplatesByCategory,
  type RoomTemplate,
} from "./room-templates";
import {
  useListMyWorldTemplates,
  useListWorldTemplates,
  useGetWorldTemplate,
  useDeleteWorldTemplate,
} from "../../../hooks/use-station";

interface Props {
  tileLayer:         TileLayer | null;
  onTileLayerChange: (tl: TileLayer) => void;
  onObjectsMerge?:   (objs: PlacedMapObject[]) => void;
  canUndo?:          boolean;
  canRedo?:          boolean;
  onUndo?:           () => void;
  onRedo?:           () => void;
}

type PaintTool  = "paint" | "erase" | "fill" | "rect" | "rect-erase" | "pan";
type PainterTab = "brush" | "rooms";
type RoomSource = "library" | "mine" | "community";

export function TilePainter({
  tileLayer, onTileLayerChange, onObjectsMerge,
  canUndo = false, canRedo = false,
  onUndo, onRedo,
}: Props) {
  const [tab,        setTab]        = useState<PainterTab>("brush");
  const [tool,       setTool]       = useState<PaintTool>("paint");
  const [selectedKey, setSelectedKey] = useState<TileTextureKey>("floor_wood");
  const [color,      setColor]      = useState<string>("#a0783c");
  const [roomSource, setRoomSource] = useState<RoomSource>("library");
  const [roomCategory, setRoomCategory] = useState<string>(ROOM_CATEGORIES[0] ?? "Residencial");
  const [remoteSearch, setRemoteSearch] = useState("");

  const myTemplatesQ   = useListMyWorldTemplates();
  const commTemplatesQ = useListWorldTemplates({ excludeMine: true, search: remoteSearch || undefined });
  const { mutateAsync: fetchTemplate } = useGetWorldTemplate();
  const { mutateAsync: deleteTemplate } = useDeleteWorldTemplate();

  const activePreset = TILE_PRESETS.find(p => p.key === selectedKey)!;

  /* ── Sincroniza ferramenta + célula → Phaser ──────────────── */
  useEffect(() => {
    if (tab !== "brush") return;
    const c: TileCell = { texture: selectedKey, layer: activePreset.layer, color };
    window.dispatchEvent(new CustomEvent("space-station:tile-tool", {
      detail: { tool, cell: c },
    }));
  }, [tab, tool, selectedKey, color, activePreset.layer]);

  /* ── Recebe alterações do Phaser ────────────────────────────── */
  useEffect(() => {
    const handler = (e: Event) => {
      const { tileLayer: tl } = (e as CustomEvent).detail as { tileLayer: TileLayer };
      onTileLayerChange(tl);
    };
    window.addEventListener("space-station:tile-layer-changed", handler);
    return () => window.removeEventListener("space-station:tile-layer-changed", handler);
  }, [onTileLayerChange]);

  function selectPreset(key: TileTextureKey) {
    const preset = TILE_PRESETS.find(p => p.key === key)!;
    setSelectedKey(key);
    setColor(preset.color);
  }

  /* ── Aplicar ambiente (hardcoded) ──────────────────────────── */
  function applyTemplate(tmpl: RoomTemplate) {
    const hasTiles = tileLayer && Object.keys(tileLayer.cells).length > 0;
    if (hasTiles) {
      if (!confirm(`Substituir tiles atuais pelo ambiente "${tmpl.name}"?\n\nVocê poderá desfazer (Ctrl+Z) depois.`)) return;
    }
    const newLayer = tmpl.generate();
    onTileLayerChange(newLayer);
    window.dispatchEvent(new CustomEvent("space-station:tile-layer", {
      detail: { tileLayer: newLayer },
    }));
  }

  /* ── Aplicar ambiente salvo (remoto — meu ou comunidade) ───── */
  async function applyRemoteTemplate(tmplId: string, tmplName: string) {
    const hasTiles = tileLayer && Object.keys(tileLayer.cells).length > 0;
    if (hasTiles) {
      if (!confirm(`Substituir tiles atuais pelo ambiente "${tmplName}"?\n\nVocê poderá desfazer (Ctrl+Z) depois.`)) return;
    }
    try {
      const { template } = await fetchTemplate({ templateId: tmplId });
      const raw = (template.mapData ?? {}) as Partial<WorldMapData>;
      const newLayer = raw.tileLayer ?? { gridW: 80, gridH: 50, tileSize: 32, cells: {} };

      onTileLayerChange(newLayer);
      window.dispatchEvent(new CustomEvent("space-station:tile-layer", {
        detail: { tileLayer: newLayer },
      }));

      // Mescla objetos (Opção 3b) — gera novos IDs para não conflitar com existentes
      if (onObjectsMerge && Array.isArray(raw.placedObjects) && raw.placedObjects.length > 0) {
        const cloned = raw.placedObjects.map((o) => ({
          ...o,
          id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        }));
        onObjectsMerge(cloned);
      }
    } catch (err) {
      console.error("[applyRemoteTemplate] error:", err);
      alert("Não foi possível carregar este ambiente.");
    }
  }

  /* ── Excluir ambiente salvo (somente em Meus) ────────────────── */
  async function handleDeleteTemplate(tmplId: string, tmplName: string) {
    if (!confirm(`Excluir permanentemente o ambiente "${tmplName}"?\n\nEsta ação não pode ser desfeita.`)) return;
    try {
      await deleteTemplate({ templateId: tmplId });
    } catch (err) {
      console.error("[handleDeleteTemplate] error:", err);
      alert("Não foi possível excluir este ambiente.");
    }
  }

  /* ── Limpar todos ───────────────────────────────────────────── */
  const clearAll = useCallback(() => {
    const empty: TileLayer = tileLayer
      ? { ...tileLayer, cells: {} }
      : { gridW: 80, gridH: 50, tileSize: 32, cells: {} };
    onTileLayerChange(empty);
    window.dispatchEvent(new CustomEvent("space-station:tile-layer", { detail: { tileLayer: empty } }));
  }, [tileLayer, onTileLayerChange]);

  const floors = TILE_PRESETS.filter(p => p.layer === "floor");
  const walls  = TILE_PRESETS.filter(p => p.layer === "wall");
  const decos  = TILE_PRESETS.filter(p => p.layer === "decoration");

  const tileCount = tileLayer ? Object.keys(tileLayer.cells).length : 0;

  return (
    <div className="flex flex-col gap-0 text-xs">

      {/* ── Undo / Redo + contagem ──────────────────────────── */}
      <div className="flex items-center gap-1 px-2 pt-2 pb-1">
        <button
          title="Desfazer (Ctrl+Z)"
          disabled={!canUndo}
          onClick={onUndo}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] border border-border bg-muted disabled:opacity-30 hover:bg-accent transition-colors"
        >
          <Undo2 size={12} /><span>Desfazer</span>
        </button>
        <button
          title="Refazer (Ctrl+Y)"
          disabled={!canRedo}
          onClick={onRedo}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] border border-border bg-muted disabled:opacity-30 hover:bg-accent transition-colors"
        >
          <Redo2 size={12} /><span>Refazer</span>
        </button>
        <div className="flex-1" />
        {tileCount > 0 && (
          <span className="text-[10px] text-muted-foreground">{tileCount} tiles</span>
        )}
      </div>

      {/* ── Tabs: Pincel / Ambientes ─────────────────────────── */}
      <div className="flex gap-0 px-2 pb-2">
        <TabBtn active={tab === "brush"} onClick={() => setTab("brush")}>
          <Pencil size={12} /><span>Pincel</span>
        </TabBtn>
        <TabBtn active={tab === "rooms"} onClick={() => setTab("rooms")}>
          <LayoutGrid size={12} /><span>Ambientes</span>
        </TabBtn>
      </div>

      {/* ══════════════════ TAB: PINCEL ═════════════════════════ */}
      {tab === "brush" && (
        <div className="flex flex-col gap-3 px-2 pb-2">
          {/* Ferramentas */}
          <div className="flex flex-wrap gap-1">
            <ToolBtn active={tool === "pan"} onClick={() => setTool("pan")} title="Mover mapa — arraste para navegar (também: botão do meio do mouse)">
              <Hand size={14} /><span>Mover</span>
            </ToolBtn>
            <ToolBtn active={tool === "paint"} onClick={() => setTool("paint")} title="Pintar (arrastar)">
              <Paintbrush size={14} /><span>Pintar</span>
            </ToolBtn>
            <ToolBtn active={tool === "rect"} onClick={() => setTool("rect")} title="Retângulo — arraste para preencher uma área (ex: 20×2)">
              <Square size={14} /><span>Retângulo</span>
            </ToolBtn>
            <ToolBtn active={tool === "fill"} onClick={() => setTool("fill")} title="Preencher área conexa (balde)">
              <PaintBucket size={14} /><span>Balde</span>
            </ToolBtn>
            <ToolBtn active={tool === "erase"} onClick={() => setTool("erase")} title="Apagar (arrastar)">
              <Eraser size={14} /><span>Apagar</span>
            </ToolBtn>
            <ToolBtn active={tool === "rect-erase"} onClick={() => setTool("rect-erase")} title="Apagar retângulo — arraste para limpar uma área">
              <SquareDashed size={14} /><span>Apagar área</span>
            </ToolBtn>
          </div>

          {tool === "pan" && (
            <p className="text-[10px] text-sky-300/80 leading-snug -mt-1">
              ✋ Arraste no mapa para mover a câmera. O botão do meio do mouse também funciona em qualquer ferramenta.
            </p>
          )}
          {(tool === "rect" || tool === "rect-erase") && (
            <p className="text-[10px] text-indigo-300/80 leading-snug -mt-1">
              💡 Arraste no mapa para {tool === "rect" ? "preencher" : "apagar"} um retângulo de tiles.
            </p>
          )}

          {/* Grupos de tiles */}
          <TileGroup label="Pisos" presets={floors} selected={selectedKey} onSelect={selectPreset} color={color} />
          <TileGroup label="Paredes" presets={walls} selected={selectedKey} onSelect={selectPreset} color={color} />
          <TileGroup label="Decoração" presets={decos} selected={selectedKey} onSelect={selectPreset} color={color} />

          {/* Color picker */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-muted-foreground">Cor:</span>
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-8 h-6 rounded cursor-pointer border border-border bg-transparent p-0"
            />
            <span className="text-muted-foreground font-mono">{color}</span>
          </div>

          {/* Limpar */}
          <button
            className="text-[11px] text-destructive underline hover:no-underline text-left"
            onClick={clearAll}
          >
            Limpar todos os tiles
          </button>
        </div>
      )}

      {/* ══════════════════ TAB: AMBIENTES ══════════════════════ */}
      {tab === "rooms" && (
        <div className="flex flex-col gap-3 px-2 pb-2">
          {/* Seletor de fonte */}
          <div className="grid grid-cols-3 gap-1">
            <SourceBtn active={roomSource === "library"} onClick={() => setRoomSource("library")}>
              <BookOpen size={12} /><span>Biblioteca</span>
            </SourceBtn>
            <SourceBtn active={roomSource === "mine"} onClick={() => setRoomSource("mine")}>
              <User size={12} /><span>Meus</span>
            </SourceBtn>
            <SourceBtn active={roomSource === "community"} onClick={() => setRoomSource("community")}>
              <Users size={12} /><span>Comunidade</span>
            </SourceBtn>
          </div>

          {/* ─── LIBRARY (hardcoded) ─────────────────────────── */}
          {roomSource === "library" && (
            <>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Ambientes prontos para começar rápido. Você pode editar depois com o Pincel.
              </p>

              <div className="flex flex-wrap gap-1">
                {ROOM_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setRoomCategory(cat)}
                    className={[
                      "px-2 py-0.5 rounded-full text-[10px] border transition-colors",
                      roomCategory === cat
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-muted text-muted-foreground border-border hover:bg-accent",
                    ].join(" ")}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {getTemplatesByCategory(roomCategory).map(tmpl => (
                  <RoomTemplateCard
                    key={tmpl.id}
                    template={tmpl}
                    onApply={applyTemplate}
                  />
                ))}
              </div>
            </>
          )}

          {/* ─── MEUS SALVOS (privados + públicos do user) ──── */}
          {roomSource === "mine" && (
            <>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Ambientes que você salvou — inclui privados e públicos. Use o botão <b>💾 Salvar ambiente</b> no rodapé para criar novos.
              </p>

              {myTemplatesQ.isLoading && (
                <div className="flex items-center justify-center py-6 text-muted-foreground text-[11px] gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
                </div>
              )}

              {myTemplatesQ.isError && (
                <div className="text-center py-4 text-[11px] space-y-1">
                  <div className="text-xl">⚠️</div>
                  <p className="text-red-400">Erro ao carregar ambientes.</p>
                  <button
                    onClick={() => myTemplatesQ.refetch()}
                    className="text-indigo-400 underline text-[10px]"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              {myTemplatesQ.isSuccess && myTemplatesQ.data.templates.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-[11px] space-y-1">
                  <div className="text-2xl">📭</div>
                  <p>Você ainda não salvou nenhum ambiente.</p>
                  <p className="text-slate-600">Crie um e clique em <b>Salvar ambiente</b>.</p>
                </div>
              )}

              {myTemplatesQ.isSuccess && myTemplatesQ.data.templates.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {myTemplatesQ.data.templates.map(t => (
                    <RemoteTemplateCard
                      key={t.id}
                      id={t.id}
                      name={t.name}
                      description={t.description}
                      previewUrl={t.previewUrl}
                      isPublic={t.isPublic}
                      showBadge
                      onApply={applyRemoteTemplate}
                      onDelete={handleDeleteTemplate}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ─── COMUNIDADE (públicos de outros) ─────────────── */}
          {roomSource === "community" && (
            <>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Ambientes públicos compartilhados por outros usuários.
              </p>

              <input
                type="text"
                placeholder="Buscar por nome…"
                value={remoteSearch}
                onChange={e => setRemoteSearch(e.target.value)}
                className="w-full bg-muted border border-border rounded-md px-2 py-1.5 text-[11px] text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
              />

              {commTemplatesQ.isLoading && (
                <div className="flex items-center justify-center py-6 text-muted-foreground text-[11px] gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
                </div>
              )}

              {commTemplatesQ.isError && (
                <div className="text-center py-4 text-[11px] space-y-1">
                  <div className="text-xl">⚠️</div>
                  <p className="text-red-400">Erro ao carregar comunidade.</p>
                  <button
                    onClick={() => commTemplatesQ.refetch()}
                    className="text-indigo-400 underline text-[10px]"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              {commTemplatesQ.isSuccess && commTemplatesQ.data.templates.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-[11px]">
                  <div className="text-2xl">🌱</div>
                  <p>Ainda não há ambientes públicos {remoteSearch && "para esta busca"}.</p>
                </div>
              )}

              {commTemplatesQ.isSuccess && commTemplatesQ.data.templates.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {commTemplatesQ.data.templates.map(t => (
                    <RemoteTemplateCard
                      key={t.id}
                      id={t.id}
                      name={t.name}
                      description={t.description}
                      previewUrl={t.previewUrl}
                      authorName={t.author?.name ?? null}
                      onApply={applyRemoteTemplate}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Limpar */}
          <button
            className="text-[11px] text-destructive underline hover:no-underline text-left mt-1"
            onClick={clearAll}
          >
            Limpar todos os tiles
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── TabBtn ──────────────────────────────────────────────────── */
function TabBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-1 px-3 py-1.5 text-[11px] border-b-2 transition-colors flex-1 justify-center",
        active
          ? "border-indigo-500 text-indigo-300"
          : "border-transparent text-muted-foreground hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ─── ToolBtn ─────────────────────────────────────────────────── */
function ToolBtn({
  active, onClick, title, children,
}: {
  active: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={[
        "flex items-center gap-1 px-2 py-1 rounded text-[11px] border transition-colors",
        active
          ? "bg-indigo-600 text-white border-indigo-500"
          : "bg-muted text-muted-foreground border-border hover:bg-accent",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ─── TileGroup ───────────────────────────────────────────────── */
interface TileGroupProps {
  label:    string;
  presets:  typeof TILE_PRESETS;
  selected: TileTextureKey;
  onSelect: (k: TileTextureKey) => void;
  color:    string;
}

function TileGroup({ label, presets, selected, onSelect, color }: TileGroupProps) {
  return (
    <div>
      <p className="text-muted-foreground uppercase tracking-wide text-[10px] mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {presets.map(p => (
          <TileCard
            key={p.key}
            preset={p}
            isSelected={selected === p.key}
            activeColor={selected === p.key ? color : p.color}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── TileCard ────────────────────────────────────────────────── */
function TileCard({
  preset, isSelected, activeColor, onSelect,
}: {
  preset:      typeof TILE_PRESETS[number];
  isSelected:  boolean;
  activeColor: string;
  onSelect:    (k: TileTextureKey) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 32, 32);
    drawTilePreviewCanvas(ctx, preset.key, activeColor, 0, 0, 32);
  }, [preset.key, activeColor]);

  return (
    <button
      title={preset.label}
      onClick={() => onSelect(preset.key)}
      className={[
        "flex flex-col items-center gap-0.5 p-1 rounded border transition-colors",
        isSelected
          ? "border-indigo-500 bg-indigo-950"
          : "border-border bg-muted hover:bg-accent",
      ].join(" ")}
    >
      <canvas
        ref={canvasRef}
        width={32}
        height={32}
        style={{ imageRendering: "pixelated", width: 32, height: 32 }}
      />
      <span className="text-[9px] text-muted-foreground leading-none">{preset.label}</span>
    </button>
  );
}

/* ─── SourceBtn ───────────────────────────────────────────────── */
function SourceBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[10px] transition-colors",
        active
          ? "bg-indigo-600 text-white border-indigo-500"
          : "bg-muted text-muted-foreground border-border hover:bg-accent",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ─── RemoteTemplateCard ─────────────────────────────────────── */
function RemoteTemplateCard({
  id, name, description, previewUrl, isPublic, showBadge, authorName, onApply, onDelete,
}: {
  id:           string;
  name:         string;
  description?: string | null;
  previewUrl?:  string | null;
  isPublic?:    boolean;
  showBadge?:   boolean;
  authorName?:  string | null;
  onApply:      (id: string, name: string) => void;
  onDelete?:    (id: string, name: string) => void | Promise<void>;
}) {
  const [applying, setApplying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleApply() {
    setApplying(true);
    try {
      await onApply(id, name);
    } finally {
      setApplying(false);
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(id, name);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="relative flex flex-col rounded-lg border border-border bg-muted overflow-hidden hover:border-indigo-500 transition-colors">
      {/* Botão excluir (somente quando onDelete é fornecido — aba Meus) */}
      {onDelete && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="Excluir este ambiente"
          className="absolute top-1 right-1 z-10 p-1 rounded-md bg-slate-950/80 backdrop-blur-sm border border-red-900/60 text-red-400 hover:text-white hover:bg-red-600 hover:border-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {deleting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </button>
      )}

      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={name}
          className="w-full object-cover"
          style={{ aspectRatio: "16/10" }}
        />
      ) : (
        <div
          className="w-full bg-slate-800 flex items-center justify-center text-2xl"
          style={{ aspectRatio: "16/10" }}
        >
          🗺️
        </div>
      )}

      <div className="px-2 py-1.5 space-y-0.5">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-medium text-white truncate flex-1">{name}</span>
          {showBadge && (
            isPublic
              ? <Globe2 className="h-2.5 w-2.5 text-emerald-400 flex-shrink-0" />
              : <Lock   className="h-2.5 w-2.5 text-slate-500 flex-shrink-0" />
          )}
        </div>
        {authorName && (
          <p className="text-[9px] text-slate-500 truncate">por {authorName}</p>
        )}
        {description && (
          <p className="text-[9px] text-slate-400 leading-snug line-clamp-2 mt-0.5">{description}</p>
        )}
        <button
          onClick={handleApply}
          disabled={applying}
          className="mt-1 w-full text-[10px] text-indigo-400 hover:text-white hover:bg-indigo-600 border border-indigo-800 hover:border-indigo-500 disabled:opacity-40 px-2 py-0.5 rounded transition-colors flex items-center justify-center gap-1"
        >
          {applying && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
          {applying ? "Aplicando…" : "Aplicar ambiente"}
        </button>
      </div>
    </div>
  );
}

/* ─── RoomTemplateCard ────────────────────────────────────────── */
function RoomTemplateCard({
  template, onApply,
}: {
  template: RoomTemplate;
  onApply:  (t: RoomTemplate) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const PREVIEW_W = 160;
  const PREVIEW_H = 100;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Gera os dados do template e desenha uma miniatura
    const layer = template.generate();
    const sx = PREVIEW_W / 80;  // escala X
    const sy = PREVIEW_H / 50;  // escala Y
    const ts = Math.max(1, Math.floor(Math.min(sx, sy) * 32));

    ctx.fillStyle = template.bgColor ?? "#0a0a0a";
    ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);

    for (const [key, cell] of Object.entries(layer.cells)) {
      const [tx, ty] = key.split(",").map(Number);
      const px = Math.floor(tx * sx * 32 / 32);
      const py = Math.floor(ty * sy * 32 / 32);
      const pw = Math.max(1, Math.floor(ts));
      const ph = Math.max(1, Math.floor(ts));
      drawTilePreviewCanvas(ctx, cell.texture as TileTextureKey, cell.color ?? "#888888", px, py, pw);
      void ph;
    }
  }, [template]);

  return (
    <button
      onClick={() => onApply(template)}
      className="flex flex-col rounded-lg border border-border bg-muted hover:border-indigo-500 hover:bg-indigo-950/30 transition-colors overflow-hidden text-left group"
    >
      {/* Preview canvas */}
      <canvas
        ref={canvasRef}
        width={PREVIEW_W}
        height={PREVIEW_H}
        style={{ imageRendering: "pixelated", width: "100%", aspectRatio: `${PREVIEW_W}/${PREVIEW_H}` }}
        className="block"
      />
      {/* Info */}
      <div className="px-2 py-1.5">
        <div className="flex items-center gap-1">
          <span className="text-sm">{template.emoji}</span>
          <span className="text-[11px] font-medium text-white truncate">{template.name}</span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
          {template.description}
        </p>
        <span className="text-[10px] text-indigo-400 mt-1 block group-hover:underline">
          Aplicar ambiente →
        </span>
      </div>
    </button>
  );
}
