"use client";

/**
 * MapEditor — Painel esquerdo estilo WorkAdventure.
 * Sidebar com ferramentas + painel direito (biblioteca, áreas, mapa, config).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X, Move, Compass, SquareDashed, Lamp, Settings as Cog, Trash2,
  DoorClosed, Save, RotateCcw, Undo2, PenLine, Share2,
  ChevronLeft, ChevronRight, GripHorizontal,
  PanelLeft, PanelBottom, Maximize2, Image as ImageIcon,
  Loader2, Check, AlertCircle,
} from "lucide-react";
import { ObjectLibrary } from "./object-library";
import { AreaEditor } from "./area-editor";
import { RoomConfig } from "./room-config";
import { ExploreRoom } from "./explore-room";
import { TilePainter } from "./tile-painter";
import { ScenarioEditor } from "./scenario-editor";
import { SaveTileTemplateModal } from "./save-tile-template-modal";
import type { LibraryItem } from "./categories";
import type {
  PlacedMapObject, StationWorldConfig, WorldMapData,
  MapArea, MapRoomConfig, TileLayer,
} from "../../../types";
import { useUpdateWorld } from "../../../hooks/use-station";

type Tool = "select" | "explore" | "areas" | "entities" | "settings" | "tiles" | "scenario";

/** Modo de ancoragem do painel do editor. */
type DockMode = "left" | "bottom" | "floating";

interface EditorLayout {
  mode:        DockMode;
  leftWidth:   number;   // largura quando "left"
  bottomH:     number;   // altura quando "bottom"
  floatX:      number;   // posição x quando "floating"
  floatY:      number;   // posição y quando "floating"
  floatW:      number;   // largura quando "floating"
  floatH:      number;   // altura quando "floating"
}

const LAYOUT_KEY = "nasa.mapEditor.layout";
const DEFAULT_LAYOUT: EditorLayout = {
  mode:      "left",
  leftWidth: 420,
  bottomH:   260,
  floatX:    80,
  floatY:    80,
  floatW:    500,
  floatH:    520,
};

function loadLayout(): EditorLayout {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<EditorLayout>;
    return { ...DEFAULT_LAYOUT, ...parsed };
  } catch { return DEFAULT_LAYOUT; }
}

interface Props {
  stationId:    string;
  worldConfig:  StationWorldConfig;
  onClose:      () => void;
  /** Callback quando a lista de placedObjects é alterada localmente (live preview) */
  onPlacedObjectsChange?: (objs: PlacedMapObject[]) => void;
  /** Callback pra aplicar mudanças no worldConfig em tempo real (preview).
   *  Usado pelo MapScenarioEditor que troca cenário, imagem de fundo, etc. */
  onWorldConfigChange?: (next: StationWorldConfig) => void;
}


export function MapEditor({
  stationId,
  worldConfig,
  onClose,
  onPlacedObjectsChange,
  onWorldConfigChange,
}: Props) {
  const { mutateAsync: updateWorld, isPending: saving } = useUpdateWorld();

  const initialMap = useMemo(
    () => (worldConfig.mapData ?? {}) as Partial<WorldMapData>,
    [worldConfig.mapData],
  );

  const [tool,       setTool]       = useState<Tool>("entities");
  const [placed,     setPlaced]     = useState<PlacedMapObject[]>(
    () => (initialMap.placedObjects ?? []),
  );
  const [areas,      setAreas]      = useState<MapArea[]>(
    () => (initialMap.areas ?? []),
  );
  const [roomConfig, setRoomConfig] = useState<MapRoomConfig>(
    () => (initialMap.roomConfig ?? {}),
  );
  const [tileLayer,    setTileLayer]    = useState<TileLayer | null>(
    () => (initialMap.tileLayer ?? null),
  );
  const [tileHistory,  setTileHistory]  = useState<TileLayer[]>([]);
  const [tileFuture,   setTileFuture]   = useState<TileLayer[]>([]);
  const [selected,     setSelected]     = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [history,      setHistory]      = useState<PlacedMapObject[][]>([]);
  const [dirty,     setDirty]     = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [layout,    setLayout]    = useState<EditorLayout>(() => loadLayout());

  /* Persiste layout no localStorage sempre que mudar */
  useEffect(() => {
    try { window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); }
    catch { /* ignore */ }
  }, [layout]);

  const setMode = useCallback((mode: DockMode) => {
    setLayout(l => ({ ...l, mode }));
    setCollapsed(false);
  }, []);

  /* ───────── Drag (apenas modo "floating") ───────────────────── */
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const startDrag = useCallback((e: React.MouseEvent) => {
    if (layout.mode !== "floating") return;
    e.preventDefault();
    dragRef.current = {
      sx: e.clientX, sy: e.clientY,
      ox: layout.floatX, oy: layout.floatY,
    };
    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current; if (!d) return;
      const maxX = window.innerWidth  - 40;
      const maxY = window.innerHeight - 40;
      setLayout(l => ({
        ...l,
        floatX: Math.max(-l.floatW + 80, Math.min(maxX, d.ox + ev.clientX - d.sx)),
        floatY: Math.max(0,              Math.min(maxY, d.oy + ev.clientY - d.sy)),
      }));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, [layout.mode, layout.floatX, layout.floatY]);

  /* ───────── Resize (bottom-right em floating, borda em left/bottom) ── */
  const startResize = useCallback((e: React.MouseEvent, edge: "se" | "e" | "n") => {
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    const snap = { ...layout };
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      setLayout(l => {
        if (edge === "e") {
          // só largura (modo left)
          return { ...l, leftWidth: Math.max(320, Math.min(900, snap.leftWidth + dx)) };
        }
        if (edge === "n") {
          // só altura (modo bottom, arrastando pra cima diminui Y → aumenta altura)
          return { ...l, bottomH: Math.max(160, Math.min(window.innerHeight - 80, snap.bottomH - dy)) };
        }
        // se → ambas (floating)
        return {
          ...l,
          floatW: Math.max(360, Math.min(window.innerWidth  - 40, snap.floatW + dx)),
          floatH: Math.max(220, Math.min(window.innerHeight - 40, snap.floatH + dy)),
        };
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, [layout]);

  /* ───────── Tile editor active state → Phaser ─────────────── */
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("space-station:tile-editor-active", {
      detail: { active: tool === "tiles" },
    }));
  }, [tool]);

  /* ───────────────────────── Phaser sync ──────────────────────── */
  const pushObjectsToPhaser = useCallback((arr: PlacedMapObject[]) => {
    window.dispatchEvent(new CustomEvent("space-station:placed-objects", {
      detail: { objects: arr },
    }));
    onPlacedObjectsChange?.(arr);
  }, [onPlacedObjectsChange]);

  const pushAreasToPhaser = useCallback((arr: MapArea[]) => {
    window.dispatchEvent(new CustomEvent("space-station:areas", {
      detail: { areas: arr },
    }));
  }, []);

  const pushRoomConfigToPhaser = useCallback((cfg: MapRoomConfig) => {
    window.dispatchEvent(new CustomEvent("space-station:room-config", {
      detail: { config: cfg },
    }));
  }, []);

  /** Estado inicial → Phaser (ativa editor) */
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("space-station:map-editor-active", {
      detail: { active: true },
    }));
    pushObjectsToPhaser(placed);
    pushAreasToPhaser(areas);
    pushRoomConfigToPhaser(roomConfig);
    return () => {
      window.dispatchEvent(new CustomEvent("space-station:map-editor-active", {
        detail: { active: false },
      }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ───────────────────────── Mutators ──────────────────────────── */
  /**
   * @param syncPhaser  Se false, não re-envia para o Phaser (objeto já foi
   *                    atualizado visualmente pelo próprio WorldScene, ex: drag
   *                    de alça de resize). Evita o loop: resize-drag → sync →
   *                    refreshSelectionHighlights → destrói a alça mid-drag.
   */
  function updateObjects(next: PlacedMapObject[], recordHistory = true, syncPhaser = true) {
    if (recordHistory) setHistory((h) => [...h, placed].slice(-30));
    setPlaced(next);
    setDirty(true);
    if (syncPhaser) pushObjectsToPhaser(next);
  }

  function updateAreas(next: MapArea[]) {
    setAreas(next);
    setDirty(true);
    pushAreasToPhaser(next);
  }

  function updateRoomConfig(patch: Partial<MapRoomConfig>) {
    const next = { ...roomConfig, ...patch };
    setRoomConfig(next);
    setDirty(true);
    pushRoomConfigToPhaser(next);
  }

  /* ───────────────────────── Objects merge (from remote template) ─ */
  const handleObjectsMerge = useCallback((objs: PlacedMapObject[]) => {
    setPlaced(prev => {
      const next = [...prev, ...objs];
      setHistory(h => [...h, prev].slice(-30));
      setDirty(true);
      pushObjectsToPhaser(next);
      return next;
    });
  }, [pushObjectsToPhaser]);

  /* ───────────────────────── Library pick / drop ───────────────── */
  const pickItem = useCallback((item: LibraryItem) => {
    // IMPORTANTE: adicionar o listener ANTES de disparar o request.
    // window.dispatchEvent é síncrono — o WorldScene responde com center-response
    // imediatamente dentro do dispatchEvent. Se adicionarmos o listener depois,
    // o evento já terá sido perdido (race condition).
    let fallbackTimer: ReturnType<typeof setTimeout>;

    const placeObj = (x: number, y: number) => {
      const obj: PlacedMapObject = {
        id:       `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        url:      item.url,
        name:     item.name,
        x, y,
        scale:    item.defaultScale ?? 1,
        rotation: 0,
        depth:    5,
      };
      updateObjects([...placed, obj]);
      setSelected(obj.id);
      // Informa o Phaser qual objeto foi selecionado → exibe alças de resize
      window.dispatchEvent(new CustomEvent("space-station:focus-object", {
        detail: { id: obj.id },
      }));
    };

    const handler = (e: Event) => {
      clearTimeout(fallbackTimer);
      window.removeEventListener("space-station:center-response", handler as EventListener);
      const { x, y } = (e as CustomEvent).detail as { x: number; y: number };
      placeObj(x, y);
    };

    window.addEventListener("space-station:center-response", handler as EventListener);

    // Fallback: se o WorldScene não responder em 500ms (ex: Phaser ainda inicializando),
    // posiciona no centro do mundo mesmo assim.
    fallbackTimer = setTimeout(() => {
      window.removeEventListener("space-station:center-response", handler as EventListener);
      placeObj(1280, 800); // centro de 2560×1600
    }, 500);

    // Dispara o request DEPOIS de adicionar o listener
    window.dispatchEvent(new CustomEvent("space-station:request-center", {}));
  }, [placed]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ───────────────────────── Phaser → React ────────────────────── */
  useEffect(() => {
    const onDropped = (e: Event) => {
      const detail = (e as CustomEvent).detail as { item: LibraryItem; x: number; y: number };
      const obj: PlacedMapObject = {
        id:     `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        url:    detail.item.url,
        name:   detail.item.name,
        x: detail.x, y: detail.y,
        scale:    detail.item.defaultScale ?? 1,
        rotation: 0,
        depth:    5,
      };
      updateObjects([...placed, obj]);
      setSelected(obj.id);
      window.dispatchEvent(new CustomEvent("space-station:focus-object", {
        detail: { id: obj.id },
      }));
    };
    const onMoved = (e: Event) => {
      const { id, x, y } = (e as CustomEvent).detail as { id: string; x: number; y: number };
      updateObjects(placed.map(p => p.id === id ? { ...p, x, y } : p), false);
    };
    const onObjSel = (e: Event) => {
      const { id } = (e as CustomEvent).detail as { id: string | null };
      setSelected(id);
      if (id) setSelectedArea(null);
    };
    const onAreaSel = (e: Event) => {
      const { id } = (e as CustomEvent).detail as { id: string | null };
      setSelectedArea(id);
      if (id) setSelected(null);
    };

    const onResized = (e: Event) => {
      const { id, scale } = (e as CustomEvent).detail as { id: string; scale: number };
      // syncPhaser = false: o WorldScene já atualizou o sprite via setScale()
      // durante o drag da alça. Re-sincronizar destruiria as alças mid-drag.
      updateObjects(placed.map(p => p.id === id ? { ...p, scale } : p), false, false);
    };

    window.addEventListener("space-station:object-dropped",  onDropped);
    window.addEventListener("space-station:object-moved",    onMoved);
    window.addEventListener("space-station:object-selected", onObjSel);
    window.addEventListener("space-station:area-selected",   onAreaSel);
    window.addEventListener("space-station:object-resized",  onResized);
    return () => {
      window.removeEventListener("space-station:object-dropped",  onDropped);
      window.removeEventListener("space-station:object-moved",    onMoved);
      window.removeEventListener("space-station:object-selected", onObjSel);
      window.removeEventListener("space-station:area-selected",   onAreaSel);
      window.removeEventListener("space-station:object-resized",  onResized);
    };
  }, [placed]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ───────────────────────── Delete helpers ────────────────────── */
  function deleteSelectedObject() {
    if (!selected) return;
    updateObjects(placed.filter(o => o.id !== selected));
    setSelected(null);
  }
  function deleteSelectedArea() {
    if (!selectedArea) return;
    updateAreas(areas.filter(a => a.id !== selectedArea));
    setSelectedArea(null);
  }
  function deleteAnySelection() {
    if (selected)      deleteSelectedObject();
    else if (selectedArea) deleteSelectedArea();
  }
  function clearAll() {
    const total = placed.length + areas.length;
    if (total === 0) return;
    if (!confirm(`Remover todos os ${total} item(s) do mapa? Esta ação pode ser desfeita.`)) return;
    updateObjects([]);
    updateAreas([]);
    setSelected(null);
    setSelectedArea(null);
  }

  /* ───────────────────────── Keyboard ──────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      // Ctrl+Z — desfazer
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        if (tool === "tiles") undoTile();
        else undo();
        return;
      }
      // Ctrl+Y ou Ctrl+Shift+Z — refazer
      if ((e.key === "y" && (e.ctrlKey || e.metaKey)) ||
          (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        e.preventDefault();
        if (tool === "tiles") redoTile();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selected || selectedArea) {
          e.preventDefault();
          deleteAnySelection();
        }
      }
      if (e.key === "Escape") {
        setSelected(null);
        setSelectedArea(null);
        window.dispatchEvent(new CustomEvent("space-station:area-draw-mode", { detail: { type: null } }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, selectedArea, tool, tileHistory, tileFuture, tileLayer]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ───────────────────────── Undo (objetos) ────────────────────── */
  function undo() {
    setHistory((h) => {
      const next = [...h];
      const last = next.pop();
      if (last) {
        setPlaced(last);
        pushObjectsToPhaser(last);
        setDirty(true);
      }
      return next;
    });
  }

  /* ───────────────────────── Tile history ──────────────────────── */
  // Estável (deps vazias) + setters funcionais → evita closures stale durante
  // bursts de eventos vindos do Phaser.
  const handleTileLayerChange = useCallback((newLayer: TileLayer) => {
    setTileLayer(prev => {
      if (prev) setTileHistory(h => [...h.slice(-49), prev]);
      return newLayer;
    });
    setTileFuture([]);
    setDirty(true);
  }, []);

  const undoTile = useCallback(() => {
    setTileHistory(h => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setTileLayer(curr => {
        if (curr) setTileFuture(f => [curr, ...f]);
        window.dispatchEvent(new CustomEvent("space-station:tile-layer", { detail: { tileLayer: prev } }));
        return prev;
      });
      setDirty(true);
      return h.slice(0, -1);
    });
  }, []);

  const redoTile = useCallback(() => {
    setTileFuture(f => {
      if (f.length === 0) return f;
      const next = f[0];
      setTileLayer(curr => {
        if (curr) setTileHistory(h => [...h, curr]);
        window.dispatchEvent(new CustomEvent("space-station:tile-layer", { detail: { tileLayer: next } }));
        return next;
      });
      setDirty(true);
      return f.slice(1);
    });
  }, []);

  /* ───────────────────────── Save ──────────────────────────────── */
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save() {
    const current = (worldConfig.mapData ?? {}) as Partial<WorldMapData>;
    const hasTiles = tileLayer && Object.keys(tileLayer.cells).length > 0;
    const nextMapData: WorldMapData = {
      ...(current as WorldMapData),
      scenario:         hasTiles ? "custom" : (current.scenario ?? "station"),
      gameView:         current.gameView         ?? "aerial",
      elements:         current.elements         ?? ({} as WorldMapData["elements"]),
      rooms:            current.rooms            ?? [],
      meetingRoomCount: current.meetingRoomCount ?? 2,
      placedObjects:    placed,
      areas,
      roomConfig,
      ...(tileLayer ? { tileLayer } : {}),
    };
    try {
      setSaveError(null);
      await updateWorld({ stationId, mapData: nextMapData });
      setDirty(false);
      setSavedAt(Date.now());
      // Autosave bem-sucedido → limpa rascunho local
      try { window.localStorage.removeItem(autosaveKey); } catch {/* ok */}
    } catch (e) {
      console.error("[MapEditor] save error:", e);
      setSaveError((e as Error)?.message ?? "Erro ao salvar");
    }
  }

  // (Auto-save removido a pedido — usuário prefere testar antes de salvar.)
  // O autosave em localStorage continua ativo mais abaixo como recovery.

  /* ───────── Autosave em localStorage (recuperação de crash) ────── */
  const autosaveKey = `space-station:map-editor:autosave:${stationId}`;

  // Salva snapshot a cada mudança quando dirty (debounce 1s)
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      try {
        const snapshot = {
          savedAt: Date.now(),
          data: { placed, areas, roomConfig, tileLayer },
        };
        window.localStorage.setItem(autosaveKey, JSON.stringify(snapshot));
      } catch {/* quota / privado — ignora */}
    }, 1000);
    return () => clearTimeout(timer);
  }, [dirty, placed, areas, roomConfig, tileLayer, autosaveKey]);

  // Beforeunload: avisa antes de fechar/recarregar/navegar com alterações
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // navegadores modernos exibem mensagem padrão
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Recuperação: se houver rascunho local, oferece restaurar uma única vez
  const [recoveryPrompted, setRecoveryPrompted] = useState(false);
  useEffect(() => {
    if (recoveryPrompted) return;
    try {
      const raw = window.localStorage.getItem(autosaveKey);
      if (!raw) {
        setRecoveryPrompted(true);
        return;
      }
      const parsed = JSON.parse(raw) as {
        savedAt: number;
        data: {
          placed: PlacedMapObject[];
          areas: MapArea[];
          roomConfig: MapRoomConfig;
          tileLayer: TileLayer | null;
        };
      };
      const minutesAgo = Math.round((Date.now() - parsed.savedAt) / 60000);
      const ago =
        minutesAgo < 1
          ? "agora há pouco"
          : minutesAgo === 1
            ? "1 minuto atrás"
            : `${minutesAgo} minutos atrás`;
      const restore = window.confirm(
        `Encontramos alterações não salvas (${ago}) deste ambiente.\n\nDeseja restaurar?`,
      );
      if (restore) {
        setPlaced(parsed.data.placed ?? []);
        setAreas(parsed.data.areas ?? []);
        setRoomConfig(parsed.data.roomConfig ?? {});
        setTileLayer(parsed.data.tileLayer ?? null);
        setDirty(true);
      } else {
        window.localStorage.removeItem(autosaveKey);
      }
    } catch {/* ignora corrompido */}
    setRecoveryPrompted(true);
  }, [recoveryPrompted, autosaveKey]);

  // Fecha o editor — se houver alterações pendentes, abre modal de
  // confirmação "Salvar alterações?" (Salvar / Descartar / Cancelar).
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const requestClose = useCallback(() => {
    if (dirty) {
      setCloseConfirmOpen(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  function openPublishModal() {
    window.dispatchEvent(new CustomEvent("space-station:publish-template-open", {
      detail: { stationId },
    }));
  }

  const selectedObj = selected ? placed.find(o => o.id === selected) ?? null : null;

  function updateSelectedObj(patch: Partial<PlacedMapObject>) {
    if (!selectedObj) return;
    updateObjects(placed.map(o => o.id === selectedObj.id ? { ...o, ...patch } : o));
  }

  const totalItems = placed.length + areas.length;
  const anySelection = Boolean(selected || selectedArea);

  /* ───────── Estilos do wrapper por modo de ancoragem ────────── */
  const wrapperStyle: React.CSSProperties = (() => {
    if (layout.mode === "left") {
      return { top: 0, left: 0, bottom: 0, width: collapsed ? 56 : layout.leftWidth };
    }
    if (layout.mode === "bottom") {
      return { bottom: 0, left: 0, right: 0, height: collapsed ? 56 : layout.bottomH };
    }
    // floating
    return {
      top: layout.floatY, left: layout.floatX,
      width: collapsed ? 56 : layout.floatW,
      height: collapsed ? 56 : layout.floatH,
    };
  })();

  const toolLabel: Record<Tool, string> = {
    select: "Objetos", explore: "Explorar", areas: "Áreas",
    entities: "Entidades", tiles: "Editor de Tiles", scenario: "Cenário",
    settings: "Configurar sala",
  };

  return (
    <>
    <div
      className="absolute z-30 flex pointer-events-none select-none"
      style={wrapperStyle}
    >
      {/* ─── SIDEBAR ─── */}
      <div className="w-14 bg-slate-950/95 backdrop-blur-md border-r border-white/5 flex flex-col items-center py-3 gap-1 pointer-events-auto flex-shrink-0 overflow-y-auto">
        <SidebarBtn icon={<X className="h-4 w-4" />} title="Fechar editor" onClick={requestClose} variant="ghost" />
        <div className="w-7 h-px bg-white/10 my-1" />

        <SidebarBtn icon={<Move         className="h-4 w-4" />} title="Selecionar / mover"          active={tool === "select"}   onClick={() => { setTool("select");   setCollapsed(false); }} />
        <SidebarBtn icon={<Compass      className="h-4 w-4" />} title="Explorar a sala"             active={tool === "explore"}  onClick={() => { setTool("explore");  setCollapsed(false); }} />
        <SidebarBtn icon={<SquareDashed className="h-4 w-4" />} title="Ferramenta de editor de área" active={tool === "areas"}    onClick={() => { setTool("areas");    setCollapsed(false); }} />
        <SidebarBtn icon={<Lamp         className="h-4 w-4" />} title="Ferramenta de editor de entidade" active={tool === "entities"} onClick={() => { setTool("entities"); setCollapsed(false); }} />
        <SidebarBtn icon={<PenLine      className="h-4 w-4" />} title="Pintar tiles (pixel art)"   active={tool === "tiles"}    onClick={() => { setTool("tiles");    setCollapsed(false); }} />
        <SidebarBtn icon={<ImageIcon    className="h-4 w-4" />} title="Cenário (imagem / modelo / Tiled)" active={tool === "scenario"} onClick={() => { setTool("scenario"); setCollapsed(false); }} />
        <SidebarBtn icon={<Cog          className="h-4 w-4" />} title="Configurar minha sala"       active={tool === "settings"} onClick={() => { setTool("settings"); setCollapsed(false); }} />

        <div className="flex-1 min-h-[4px]" />

        <SidebarBtn
          icon={<Trash2 className="h-4 w-4" />}
          title={anySelection ? "Excluir selecionado (Del)" : "Limpar tudo"}
          onClick={() => { if (anySelection) deleteAnySelection(); else clearAll(); }}
          variant="danger"
          disabled={totalItems === 0 && !anySelection}
        />
        <SidebarBtn
          icon={<Undo2 className="h-4 w-4" />}
          title="Desfazer"
          onClick={undo}
          disabled={history.length === 0}
        />

        {/* Collapse toggle — oculta/mostra o painel para liberar a tela */}
        <div className="w-7 h-px bg-white/10 my-1" />
        <SidebarBtn
          icon={collapsed
            ? <ChevronRight className="h-4 w-4" />
            : <ChevronLeft  className="h-4 w-4" />}
          title={collapsed ? "Expandir painel" : "Recolher painel (ver mapa)"}
          onClick={() => setCollapsed(v => !v)}
        />
      </div>

      {/* ─── PANEL ─── */}
      {!collapsed && (
      <div className="flex-1 bg-slate-900/95 backdrop-blur-md border-r border-white/5 flex flex-col min-h-0 pointer-events-auto overflow-hidden relative">
        {/* ── Header: drag handle + dock mode buttons ── */}
        <div
          className={`flex items-center gap-1 px-2 h-8 bg-slate-950/80 border-b border-white/5 flex-shrink-0 ${
            layout.mode === "floating" ? "cursor-move" : ""
          }`}
          onMouseDown={layout.mode === "floating" ? startDrag : undefined}
        >
          {layout.mode === "floating" && (
            <GripHorizontal className="h-3 w-3 text-slate-500 flex-shrink-0" />
          )}
          <span className="text-[11px] text-slate-400 font-medium flex-1 truncate select-none">
            Editor — {toolLabel[tool]}
          </span>
          <DockBtn active={layout.mode === "left"}    onClick={() => setMode("left")}    title="Encaixar à esquerda">
            <PanelLeft className="h-3.5 w-3.5" />
          </DockBtn>
          <DockBtn active={layout.mode === "bottom"}  onClick={() => setMode("bottom")}  title="Encaixar embaixo (barra horizontal)">
            <PanelBottom className="h-3.5 w-3.5" />
          </DockBtn>
          <DockBtn active={layout.mode === "floating"} onClick={() => setMode("floating")} title="Flutuante (arrastar e soltar)">
            <Maximize2 className="h-3.5 w-3.5" />
          </DockBtn>
        </div>

        {tool === "entities" && (
          <ObjectLibrary
            onPick={pickItem}
            onAfterCustomImport={() => setTool("select")}
          />
        )}

        {tool === "tiles" && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            <div className="px-5 pt-5 pb-3 border-b border-white/5">
              <h2 className="text-lg font-semibold text-white tracking-tight">Editor de Tiles</h2>
              <p className="text-xs text-slate-400 mt-0.5">Pinte tiles ou escolha um ambiente pronto.</p>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              <TilePainter
                tileLayer={tileLayer}
                onTileLayerChange={handleTileLayerChange}
                onObjectsMerge={handleObjectsMerge}
                canUndo={tileHistory.length > 0}
                canRedo={tileFuture.length > 0}
                onUndo={undoTile}
                onRedo={redoTile}
              />
            </div>
          </div>
        )}

        {tool === "select" && (
          <InspectorPanel
            placed={placed}
            selectedObj={selectedObj}
            onSelect={(id) => {
              setSelected(id);
              setSelectedArea(null);
              window.dispatchEvent(new CustomEvent("space-station:focus-object", { detail: { id } }));
            }}
            onDelete={deleteSelectedObject}
            onUpdate={updateSelectedObj}
          />
        )}

        {tool === "areas"    && <AreaEditor  areas={areas} onChange={updateAreas} />}
        {tool === "scenario" && (
          <ScenarioEditor
            stationId={stationId}
            worldConfig={worldConfig}
            onWorldConfigChange={onWorldConfigChange}
          />
        )}
        {tool === "settings" && <RoomConfig  value={roomConfig} onChange={updateRoomConfig} />}
        {tool === "explore"  && <ExploreRoom placedObjects={placed} areas={areas} />}

        {/* Footer */}
        <div className="border-t border-white/5 p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <DoorClosed className="h-3 w-3" />
              <span>{placed.length} obj · {areas.length} áreas</span>
              {tileLayer && Object.keys(tileLayer.cells).length > 0 && (
                <span className="text-indigo-400">· {Object.keys(tileLayer.cells).length} tiles</span>
              )}
            </div>
            <div className="flex-1" />
            {/* Indicador de status de save (info — não auto-salva mais) */}
            <SaveStatus
              saving={saving}
              dirty={dirty}
              error={saveError}
              savedAt={savedAt}
              onRetry={() => void save()}
            />
            <button
              onClick={requestClose}
              className="text-xs text-slate-300 hover:text-white px-2 py-1 rounded-md hover:bg-white/5 transition-colors flex items-center gap-1"
              title="Fechar editor"
            >
              <RotateCcw className="h-3 w-3" /> Fechar
            </button>
            <button
              onClick={() => void save()}
              disabled={saving || !dirty}
              className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors"
            >
              <Save className="h-3 w-3" />
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                window.dispatchEvent(new CustomEvent("space-station:save-tile-template-open"))
              }
              title="Salva o conjunto de tiles atual como um modelo reutilizável (não salva o mundo). Use o botão 'Salvar' acima pra persistir o mundo."
              className="flex-1 text-xs text-emerald-300 hover:text-white border border-emerald-900 hover:border-emerald-500 hover:bg-emerald-900/30 px-3 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors"
            >
              <Save className="h-3 w-3" /> Salvar como modelo
            </button>
            <button
              onClick={openPublishModal}
              title="Publica o mundo atual como um Template público pra outros users clonarem. Não substitui o 'Salvar' — sempre salve antes."
              className="flex-1 text-xs text-indigo-300 hover:text-white border border-indigo-800 hover:border-indigo-500 hover:bg-indigo-900/30 px-3 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors"
            >
              <Share2 className="h-3 w-3" /> Publicar Template
            </button>
          </div>
        </div>

        {/* ── Resize handles: dependem do modo ── */}
        {layout.mode === "left" && (
          <div
            onMouseDown={(e) => startResize(e, "e")}
            className="absolute top-0 right-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-indigo-500/40 transition-colors"
            title="Arraste para redimensionar largura"
          />
        )}
        {layout.mode === "floating" && (
          <div
            onMouseDown={(e) => startResize(e, "se")}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-indigo-500/40 transition-colors flex items-end justify-end"
            title="Arraste para redimensionar"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" className="text-slate-500">
              <path d="M 9 3 L 3 9 M 9 6 L 6 9 M 9 9 L 9 9" stroke="currentColor" strokeWidth="1" />
            </svg>
          </div>
        )}
      </div>
      )}

      {/* ── Resize handle superior (modo bottom) fora do painel ── */}
      {!collapsed && layout.mode === "bottom" && (
        <div
          onMouseDown={(e) => startResize(e, "n")}
          className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-indigo-500/40 transition-colors pointer-events-auto z-10"
          title="Arraste para redimensionar altura"
        />
      )}

    </div>

    {/* Modal salvar ambiente — fora do wrapper pointer-events-none para herança CSS não bloquear inputs */}
    <SaveTileTemplateModal
      stationId={stationId}
      tileLayer={tileLayer}
      placedObjects={placed}
    />

    {/* Modal "Salvar alterações?" ao fechar com mudanças pendentes */}
    {closeConfirmOpen && (
      <CloseConfirmModal
        saving={saving}
        onSaveAndClose={async () => {
          await save();
          setCloseConfirmOpen(false);
          onClose();
        }}
        onDiscardAndClose={() => {
          // Limpa rascunho local também, pra não disparar recovery prompt depois
          try {
            window.localStorage.removeItem(autosaveKey);
          } catch {
            /* ok */
          }
          setCloseConfirmOpen(false);
          onClose();
        }}
        onCancel={() => setCloseConfirmOpen(false)}
      />
    )}
    </>
  );
}

/* ─── Modal: Salvar alterações antes de fechar? ───────────────── */

function CloseConfirmModal({
  saving,
  onSaveAndClose,
  onDiscardAndClose,
  onCancel,
}: {
  saving: boolean;
  onSaveAndClose: () => void;
  onDiscardAndClose: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-white mb-2">
          Salvar alterações?
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-5">
          Você tem alterações no mapa que ainda não foram salvas. O que deseja
          fazer?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onSaveAndClose}
            disabled={saving}
            className="w-full px-3 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {saving ? "Salvando..." : "Salvar e sair"}
          </button>
          <button
            onClick={onDiscardAndClose}
            disabled={saving}
            className="w-full px-3 py-2 rounded-md text-sm font-medium text-red-300 border border-red-500/30 bg-red-500/5 hover:bg-red-500/15 disabled:opacity-50 transition-colors"
          >
            Descartar alterações
          </button>
          <button
            onClick={onCancel}
            disabled={saving}
            className="w-full px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:bg-white/5 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────── Sidebar button ──────────────── */
function SidebarBtn({
  icon, title, active, onClick, disabled, variant,
}: {
  icon: React.ReactNode; title: string;
  active?: boolean; onClick?: () => void; disabled?: boolean;
  variant?: "ghost" | "danger";
}) {
  const base = "w-10 h-10 rounded-lg flex items-center justify-center transition-colors border";
  const cls = disabled
    ? `${base} border-transparent text-slate-600 cursor-not-allowed`
    : active
      ? `${base} border-indigo-400/40 bg-indigo-500/10 text-indigo-300`
      : variant === "danger"
        ? `${base} border-transparent text-slate-400 hover:bg-rose-500/10 hover:text-rose-400`
        : variant === "ghost"
          ? `${base} border-transparent text-slate-400 hover:bg-white/5 hover:text-white`
          : `${base} border-transparent text-slate-400 hover:bg-white/5 hover:text-white`;
  return (
    <button onClick={onClick} title={title} disabled={disabled} className={cls}>
      {icon}
    </button>
  );
}

/* ──────────────── Dock mode button (header bar) ──────────────── */
function DockBtn({
  children, active, onClick, title,
}: {
  children: React.ReactNode;
  active?:  boolean;
  onClick?: () => void;
  title?:   string;
}) {
  const cls = active
    ? "w-6 h-6 rounded flex items-center justify-center text-indigo-300 bg-indigo-500/20 border border-indigo-500/30"
    : "w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 border border-transparent";
  return (
    <button onClick={onClick} title={title} className={cls}>
      {children}
    </button>
  );
}

/* ──────────────── Inspector (selected object) ──────────────── */
function InspectorPanel({
  placed, selectedObj, onSelect, onDelete, onUpdate,
}: {
  placed:     PlacedMapObject[];
  selectedObj: PlacedMapObject | null;
  onSelect:   (id: string | null) => void;
  onDelete:   () => void;
  onUpdate:   (patch: Partial<PlacedMapObject>) => void;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-5 pt-5 pb-3 border-b border-white/5">
        <h2 className="text-lg font-semibold text-white tracking-tight">Objetos do mapa</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {placed.length} item(s) — clique para selecionar e ajustar.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {placed.length === 0 && (
          <div className="flex flex-col items-center py-12 text-slate-500">
            <Lamp className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Nenhum objeto no mapa</p>
            <p className="text-xs text-slate-600 mt-1">Abra a aba de Entidades para adicionar</p>
          </div>
        )}
        {placed.map((o) => (
          <button
            key={o.id}
            onClick={() => onSelect(o.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left border transition-colors ${
              selectedObj?.id === o.id
                ? "border-indigo-400/40 bg-indigo-500/10"
                : "border-transparent hover:bg-white/5"
            }`}
          >
            <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.url} alt="" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white truncate">{o.name}</div>
              <div className="text-[10px] text-slate-500 tabular-nums">
                x {Math.round(o.x)} · y {Math.round(o.y)} · {Math.round((o.scale ?? 1) * 100)}%
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Edit panel */}
      {selectedObj && (
        <div className="border-t border-white/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white flex-1 truncate">{selectedObj.name}</span>
            <button
              onClick={onDelete}
              className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Excluir"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <LabeledSlider
            label="Escala"
            value={selectedObj.scale ?? 1}
            min={0.2} max={4} step={0.05}
            fmt={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdate({ scale: v })}
          />
          <LabeledSlider
            label="Rotação"
            value={selectedObj.rotation ?? 0}
            min={-180} max={180} step={5}
            fmt={(v) => `${Math.round(v)}°`}
            onChange={(v) => onUpdate({ rotation: v })}
          />
          <LabeledSlider
            label="Profundidade"
            value={selectedObj.depth ?? 5}
            min={1} max={50} step={1}
            fmt={(v) =>
              `${Math.round(v)}${(v ?? 0) >= 25 ? " (acima do avatar)" : ""}`
            }
            onChange={(v) => onUpdate({ depth: v })}
          />

          {/* Toggle "À frente do avatar" — atalho que seta depth=30 (acima
              do avatar, que renderiza em ~20-21). Quando desligado, volta
              ao default 5 (atrás). Também emite evento direto pro Phaser
              forçar setDepth no sprite caso o sync demore a propagar. */}
          {(() => {
            const isFront = (selectedObj.depth ?? 5) >= 25;
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  // depth=50 garante render acima do avatar (20) E do tile
                  // overlay (30), eliminando qualquer empate de z-order.
                  const newDepth = isFront ? 5 : 50;
                  onUpdate({ depth: newDepth });
                  // Força aplicação imediata no Phaser via event direto — não
                  // espera o sync passar por toda a cadeia React → Phaser.
                  window.dispatchEvent(
                    new CustomEvent("space-station:force-object-depth", {
                      detail: { id: selectedObj.id, depth: newDepth },
                    }),
                  );
                }}
                title="Quando ligado, este objeto renderiza ACIMA do avatar (telhado, copa de árvore, luminária pendurada, etc.)."
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md border text-xs cursor-pointer select-none transition-colors text-left ${
                  isFront
                    ? "border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-200"
                    : "border-white/10 bg-slate-800/40 text-slate-300 hover:bg-slate-800/60"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    isFront
                      ? "bg-fuchsia-500 border-fuchsia-500 text-white"
                      : "border-slate-500 bg-transparent"
                  }`}
                >
                  {isFront && (
                    <svg
                      viewBox="0 0 12 12"
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M2 6l3 3 5-6" />
                    </svg>
                  )}
                </span>
                <span className="font-medium flex-1">À frente do avatar</span>
                {isFront && (
                  <span className="text-[10px] text-fuchsia-300/80">acima</span>
                )}
              </button>
            );
          })()}

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selectedObj.solid ?? false}
              onChange={(e) => onUpdate({ solid: e.target.checked })}
              className="accent-indigo-500"
            />
            <span>Colisão com jogadores</span>
          </label>
        </div>
      )}
    </div>
  );
}

function LabeledSlider({
  label, value, min, max, step, fmt, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  fmt: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-200 font-mono tabular-nums">{fmt(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-indigo-500"
      />
    </div>
  );
}

/* ─── Indicador de auto-save ──────────────────────────────────────────── */

function SaveStatus({
  saving,
  dirty,
  error,
  savedAt,
  onRetry,
}: {
  saving: boolean;
  dirty: boolean;
  error: string | null;
  savedAt: number | null;
  onRetry: () => void;
}) {
  // Estado mais informativo possível dado os flags atuais.
  if (error) {
    return (
      <button
        type="button"
        onClick={onRetry}
        title={error}
        className="text-[11px] flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 transition-colors"
      >
        <AlertCircle className="h-3 w-3" />
        Erro — clicar pra tentar
      </button>
    );
  }
  if (saving) {
    return (
      <span className="text-[11px] flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
        <Loader2 className="h-3 w-3 animate-spin" />
        Salvando...
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="text-[11px] flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300">
        <Save className="h-3 w-3" />
        Aguardando...
      </span>
    );
  }
  if (savedAt) {
    return (
      <span
        className="text-[11px] flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
        title={`Salvo automaticamente às ${new Date(savedAt).toLocaleTimeString()}`}
      >
        <Check className="h-3 w-3" />
        Salvo
      </span>
    );
  }
  return (
    <span className="text-[11px] flex items-center gap-1.5 px-2 py-1 rounded-md text-slate-500">
      <Save className="h-3 w-3" />
      Auto-save
    </span>
  );
}
