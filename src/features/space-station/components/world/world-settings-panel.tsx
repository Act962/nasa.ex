"use client";

import { useEffect, useRef, useState } from "react";
import {
  X, Settings, Rocket, Star, Globe, User, Check, AlertCircle, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useUpdateWorld, useListStations,
  useListWorldTemplates, useApplyWorldTemplate,
} from "../../hooks/use-station";
import { WokaCustomizer, WOKA_TABS, type WokaTabId } from "./woka-customizer";
import type {
  AvatarConfig, StationWorldConfig, WorldMapData, WorldElementsConfig,
  RoomConfig, ScenarioType, HairStyle, BeardStyle, FaceAccessory,
} from "../../types";
import { DEFAULT_ELEMENTS, DEFAULT_ROOMS, DEFAULT_AVATAR_CONFIG } from "../../types";
import { fetchTiledMeta } from "../../utils/tiled-loader";
import { toast } from "sonner";

interface Props {
  stationId: string;
  worldConfig: StationWorldConfig;
  avatarConfig?: AvatarConfig;
  nick: string;
  userImage?: string | null;
  onClose: () => void;
  onApply: (worldConfig: StationWorldConfig, avatarConfig: AvatarConfig) => void;
}

// Cada tab agora é uma categoria do avatar (Body / Eyes / Hair / etc).

const SCENARIOS: {
  id: ScenarioType; label: string; emoji: string; description: string;
  bg: string; accent: string; tag: string;
  /** URL de preview real — pixel-art WA map ou foto temática */
  previewImg?: string;
}[] = [
  {
    id: "station", label: "Estação Espacial", emoji: "🏢",
    description: "Escritório corporativo com área verde externa",
    bg: "#0d1a10", accent: "#5fa83c", tag: "Escritório",
    previewImg: "https://raw.githubusercontent.com/workadventure/map-starter-kit/master/office.png",
  },
  {
    id: "space", label: "Espaço Profundo", emoji: "🌌",
    description: "Nebulosas, asteroides e plataformas flutuantes",
    bg: "#04020f", accent: "#7c3aed", tag: "Espaço",
    previewImg: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=640&q=80&auto=format&fit=crop",
  },
  {
    id: "rocket", label: "Interior da Nave", emoji: "🚀",
    description: "Corridores e decks de uma espaçonave",
    bg: "#0e0a06", accent: "#ff6b35", tag: "Nave",
    previewImg: "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=640&q=80&auto=format&fit=crop",
  },
  {
    id: "lunar_base", label: "Base Lunar", emoji: "🌕",
    description: "Domos pressurizados na superfície da Lua",
    bg: "#0a0a0f", accent: "#00d4ff", tag: "Lua",
    previewImg: "https://images.unsplash.com/photo-1446941303997-a7fd0a0da6a6?w=640&q=80&auto=format&fit=crop",
  },
  {
    id: "mission_control", label: "Centro de Missão", emoji: "📡",
    description: "Sala de controle com painéis e monitores",
    bg: "#060c14", accent: "#00ff88", tag: "Controle",
    previewImg: "https://raw.githubusercontent.com/workadventure/wa-internal-map/master/map.png",
  },
  {
    id: "lab", label: "Laboratório Orbital", emoji: "🔬",
    description: "Lab científico com câmaras e centrifugas",
    bg: "#080818", accent: "#9b30ff", tag: "Lab",
    previewImg: "https://raw.githubusercontent.com/workadventure/classroom/master/map.png",
  },
  {
    id: "hangar", label: "Hangar de Naves", emoji: "🛸",
    description: "Hangar com naves estacionadas e ferramentas",
    bg: "#0a0a0e", accent: "#ffd700", tag: "Hangar",
    previewImg: "https://raw.githubusercontent.com/workadventure/game-room/master/map.png",
  },
  {
    id: "mars", label: "Colônia de Marte", emoji: "🔴",
    description: "Colônia presurizada no deserto vermelho",
    bg: "#200a04", accent: "#ff6644", tag: "Marte",
    previewImg: "https://images.unsplash.com/photo-1614732414444-096e5f1122d5?w=640&q=80&auto=format&fit=crop",
  },
  {
    id: "observatory", label: "Observatório", emoji: "🔭",
    description: "Cúpula astronômica sob céu estrelado",
    bg: "#010108", accent: "#aaaacc", tag: "Obs.",
    previewImg: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=640&q=80&auto=format&fit=crop",
  },
  {
    id: "bridge", label: "Deck de Comando", emoji: "🖖",
    description: "Ponte de uma espaçonave estelar",
    bg: "#04060a", accent: "#0088ff", tag: "Ponte",
    previewImg: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=640&q=80&auto=format&fit=crop",
  },
  {
    id: "custom", label: "Canvas em Branco", emoji: "🎨",
    description: "Crie seu mundo do zero com o editor de tiles",
    bg: "#0a0a14", accent: "#6366f1", tag: "Custom",
    // Sem imagem — gradiente é perfeito para "tela em branco"
  },
];


const SUIT_COLORS   = ["#7c3aed","#2563eb","#16a34a","#dc2626","#ea580c","#0891b2","#4f46e5","#be185d","#ffffff","#111827"];
const HELMET_COLORS = ["#06b6d4","#f59e0b","#10b981","#f43f5e","#8b5cf6","#3b82f6","#ffffff","#e2e8f0"];
const SKIN_TONES    = ["#FFDBB4","#EDB98A","#D08B5B","#AE5D29","#694D3D","#292018"];
const HAIR_COLORS   = ["#2d1a0e","#8B4513","#FFD700","#CC0000","#1a1a1a","#808080","#ffffff","#4B0082"];

const HAIR_STYLES: { value: HairStyle; label: string; emoji: string }[] = [
  { value: "none",    label: "Careca",    emoji: "👤" },
  { value: "short",   label: "Curto",     emoji: "👱" },
  { value: "long",    label: "Longo",     emoji: "👩" },
  { value: "curly",   label: "Cacheado",  emoji: "🌀" },
  { value: "afro",    label: "Afro",      emoji: "✊" },
  { value: "ponytail",label: "Rabo",      emoji: "🎀" },
];

const BEARD_STYLES: { value: BeardStyle; label: string; emoji: string }[] = [
  { value: "none",    label: "Sem barba",  emoji: "😊" },
  { value: "stubble", label: "Cavanhaque", emoji: "😏" },
  { value: "short",   label: "Curta",      emoji: "🧔" },
  { value: "full",    label: "Cheia",      emoji: "🧔‍♂️" },
];

const FACE_ACCESSORIES: { value: FaceAccessory; label: string; emoji: string }[] = [
  { value: "none",       label: "Nenhum",    emoji: "😊" },
  { value: "glasses",    label: "Óculos",    emoji: "🤓" },
  { value: "sunglasses", label: "Sol",        emoji: "😎" },
];

export function WorldSettingsPanel({ stationId, worldConfig, avatarConfig, nick, userImage, onClose, onApply }: Props) {
  const [wokaTab, setWokaTab] = useState<WokaTabId>("body");
  const [avatarDirty, setAvatarDirty] = useState(false);
  // Ref síncrono pra requestClose ler o estado mais atual sem esperar re-render.
  // BUG FIX: quando o user clicava "Terminar" no WokaCustomizer (upload de
  // sprite custom), o customizer chamava `onChange(partial)` e logo em seguida
  // `onClose()`. O onChange agendava setAvatarDirty(true), mas requestClose
  // rodava no MESMO event tick e lia `avatarDirty=false` da closure stale →
  // pulava o modal "Salvar?" e fechava sem persistir. Ref resolve isso.
  const avatarDirtyRef = useRef(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  function markAvatarDirty(v: boolean) {
    avatarDirtyRef.current = v;
    setAvatarDirty(v);
  }

  function handleSaveAvatar(onDone?: () => void) {
    setSaveError(null);
    updateWorld(
      { stationId, avatarConfig: avatar, mapData: buildMapData() },
      {
        onSuccess: () => {
          markAvatarDirty(false);
          onDone?.();
        },
        onError: (err) => {
          setSaveError(
            (err as { message?: string })?.message ?? "Erro ao salvar",
          );
        },
      },
    );
  }

  // Fecha o painel — se houver alterações pendentes, abre o modal.
  // Lê do ref (síncrono) pra cobrir o caso de onChange+onClose no mesmo tick.
  const requestClose = () => {
    if (avatarDirtyRef.current) {
      setCloseConfirmOpen(true);
      return;
    }
    onClose();
  };
  const raw = (worldConfig.mapData as WorldMapData | null);

  const gameView = "aerial" as const;
  const [scenario,        setScenario]         = useState<WorldMapData["scenario"]>(raw?.scenario ?? "station");
  const [rooms,           setRooms]            = useState<RoomConfig[]>(raw?.rooms ?? DEFAULT_ROOMS);
  const [meetingRoomCount,setMeetingRoomCount] = useState<number>(raw?.meetingRoomCount ?? 2);
  const [elements,        setElements]         = useState<WorldElementsConfig>({ ...DEFAULT_ELEMENTS, ...(raw?.elements ?? {}) });
  const [avatar,          setAvatar]           = useState<AvatarConfig>({
    ...DEFAULT_AVATAR_CONFIG,
    ...avatarConfig,
  });

  const { mutate: updateWorld, isPending } = useUpdateWorld();
  const { data: stationsData } = useListStations({ type: "ORG" });

  const [selectedChair,    setSelectedChair]    = useState<string | null>(raw?.selectedAssets?.chair    ?? null);
  const [selectedDesk,     setSelectedDesk]     = useState<string | null>(raw?.selectedAssets?.desk     ?? null);
  const [selectedComputer, setSelectedComputer] = useState<string | null>(raw?.selectedAssets?.computer ?? null);
  const [selectedFurniture,setSelectedFurniture]= useState<string | null>(raw?.selectedAssets?.furniture?? null);
  const [tiledMapUrl,  setTiledMapUrl]  = useState<string>(raw?.tiledMapUrl  ?? "");
  const [tiledBaseUrl, setTiledBaseUrl] = useState<string>(raw?.tiledBaseUrl ?? "");
  const [bgImageUrl,    setBgImageUrl]    = useState<string>(raw?.backgroundImageUrl ?? "");
  const [bgImageWidth,  setBgImageWidth]  = useState<number | undefined>(raw?.backgroundImageWidth);
  const [bgImageHeight, setBgImageHeight] = useState<number | undefined>(raw?.backgroundImageHeight);
  const [bgUploading,   setBgUploading]   = useState(false);
  const [bgUploadError, setBgUploadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function toggleRoom(type: RoomConfig["type"]) {
    setRooms((prev) => prev.map((r) => r.type === type ? { ...r, enabled: !r.enabled } : r));
  }

  function buildMapData(): WorldMapData {
    // Preserva trabalho feito no Map Editor (objetos, áreas, tiles, salas)
    // — esses campos não são editados aqui, mas se omitidos o servidor faz
    // REPLACE total do mapData e apaga tudo. Bug grave de perda de trabalho.
    const previous = (raw ?? {}) as Partial<WorldMapData>;
    return {
      gameView, scenario, elements, rooms, meetingRoomCount,
      selectedAssets: {
        chair:     selectedChair    ?? undefined,
        desk:      selectedDesk     ?? undefined,
        computer:  selectedComputer ?? undefined,
        furniture: selectedFurniture ?? undefined,
      },
      tiledMapUrl:  tiledMapUrl  || undefined,
      tiledBaseUrl: tiledBaseUrl || undefined,
      backgroundImageUrl:    bgImageUrl || undefined,
      backgroundImageWidth:  bgImageWidth,
      backgroundImageHeight: bgImageHeight,
      // Preservados:
      placedObjects: previous.placedObjects,
      areas:         previous.areas,
      tileLayer:     previous.tileLayer,
      roomConfig:    previous.roomConfig,
    };
  }

  async function handleBgImageUpload(file: File) {
    setBgUploadError(null);
    if (!file.type.startsWith("image/")) {
      setBgUploadError("Selecione um arquivo de imagem.");
      return;
    }
    setBgUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload-local", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!data.url) throw new Error(data.error ?? "Sem URL retornada");
      // Lê dimensões nativas da imagem pra setar bounds default do mapa
      const img = new window.Image();
      const dimensions = await new Promise<{ w: number; h: number }>(
        (resolve, reject) => {
          img.onload = () =>
            resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => reject(new Error("Imagem inválida"));
          img.src = data.url!;
        },
      );
      setBgImageUrl(data.url);
      setBgImageWidth(dimensions.w);
      setBgImageHeight(dimensions.h);
      setScenario("image");
    } catch (e) {
      setBgUploadError(`Falha: ${(e as Error).message}`);
    } finally {
      setBgUploading(false);
    }
  }

  // Apply immediately to the live game (no DB save yet)
  function applyPreview(newMapData: WorldMapData, newAvatar: AvatarConfig = avatar) {
    onApply({ ...worldConfig, mapData: newMapData }, newAvatar);
  }

  // ── Preview ao vivo ──────────────────────────────────────────────────
  // Sempre que o usuário muda algo no painel (cenário, mapa Tiled, salas,
  // etc.) re-aplica preview pra o mundo refletir a escolha imediatamente,
  // antes mesmo de clicar em "Salvar". Sem isso o user clica num card e
  // tem a impressão de que "nada acontece".
  // Skipa o primeiro render pra não disparar update redundante no mount.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    try {
      applyPreview(buildMapData());
    } catch (err) {
      console.warn("[WorldSettingsPanel] preview failed:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    scenario,
    rooms,
    meetingRoomCount,
    elements,
    selectedChair,
    selectedDesk,
    selectedComputer,
    selectedFurniture,
    tiledMapUrl,
    tiledBaseUrl,
  ]);

  function handleSave() {
    setSaveError(null);
    let newMapData: WorldMapData;
    try {
      newMapData = buildMapData();
    } catch (e) {
      console.error("[WorldSettingsPanel] buildMapData failed:", e);
      setSaveError("Erro ao montar configuração. Recarregue a página.");
      toast.error("Erro ao salvar — recarregue e tente de novo.");
      return;
    }

    // Apply immediately for instant feedback (não bloqueia o save se falhar)
    try {
      applyPreview(newMapData);
    } catch (e) {
      console.warn("[WorldSettingsPanel] applyPreview failed:", e);
    }

    // Persist and close
    updateWorld(
      { stationId, avatarConfig: avatar, mapData: newMapData },
      {
        onSuccess: () => {
          toast.success("Mundo salvo!");
          onClose();
        },
        onError: (err) => {
          const msg = (err as { message?: string })?.message ?? "Erro ao salvar configurações";
          setSaveError(msg);
          toast.error(`Falha ao salvar: ${msg}`);
        },
      },
    );
  }

  // Avatar preview composto
  return (
    <>
    <div className="absolute inset-y-0 right-0 z-30 w-[480px] flex flex-col bg-slate-950/98 backdrop-blur-md border-l border-white/10 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-indigo-400" />
          <h2 className="text-white font-semibold text-sm">Configurar Mundo</h2>
        </div>
        <button onClick={requestClose} className="text-slate-400 hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs do avatar (Body / Eyes / Hair / …) — controlam o WokaCustomizer */}
      <div
        className="flex border-b border-white/10 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {WOKA_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => t.available && setWokaTab(t.id)}
            disabled={!t.available}
            className={`flex-1 min-w-fit flex flex-col items-center gap-0.5 py-2.5 px-2 text-[10px] font-medium transition-colors whitespace-nowrap ${
              wokaTab === t.id
                ? "text-white border-b-2 border-indigo-400 bg-white/5"
                : t.available
                  ? "text-slate-400 hover:text-slate-200"
                  : "text-slate-600 cursor-not-allowed"
            }`}
            title={!t.available ? "Em breve" : t.label}
          >
            <span className="text-base leading-none">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Avatar customizer — preview ao vivo, persiste só ao Salvar ── */}
      <div className="flex-1 overflow-hidden min-h-0">
        <WokaCustomizer
          avatarConfig={avatar}
          externalTab={wokaTab}
          onChange={(partial) => {
            const next = { ...avatar, ...partial };
            setAvatar(next);
            // markAvatarDirty atualiza ref + state — ref é lido por
            // requestClose síncronamente no mesmo tick (evita stale closure).
            markAvatarDirty(true);
            // Preview ao vivo — atualiza canvas SEM persistir no DB
            onApply({ ...worldConfig, mapData: buildMapData() }, next);
          }}
          onClose={requestClose}
        />
      </div>

      {/* Footer: botão Salvar + indicador de erro */}
      <div className="px-5 py-3 border-t border-white/10 flex items-center gap-3">
        {saveError && (
          <div className="flex items-start gap-1.5 text-[11px] text-red-400 flex-1">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>{saveError}</span>
          </div>
        )}
        {!saveError && avatarDirty && (
          <span className="text-[11px] text-amber-400 flex-1">
            Você tem alterações não salvas
          </span>
        )}
        {!saveError && !avatarDirty && (
          <span className="text-[11px] text-slate-500 flex-1">
            Faça alterações e clique em Salvar
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={requestClose}
          className="text-slate-400 hover:text-white"
        >
          Fechar
        </Button>
        <Button
          size="sm"
          onClick={() => handleSaveAvatar()}
          disabled={isPending || !avatarDirty}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {isPending ? "Salvando..." : "💾 Salvar"}
        </Button>
      </div>
    </div>

    {/* Modal "Salvar alterações?" ao fechar */}
    {closeConfirmOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={() => setCloseConfirmOpen(false)}
      >
        <div
          className="w-full max-w-sm rounded-xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-base font-semibold text-white mb-2">
            Salvar alterações?
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-5">
            Você tem alterações no avatar que ainda não foram salvas. O que
            deseja fazer?
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                handleSaveAvatar(() => {
                  setCloseConfirmOpen(false);
                  onClose();
                });
              }}
              disabled={isPending}
              className="w-full px-3 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Salvando..." : "Salvar e sair"}
            </button>
            <button
              onClick={() => {
                setCloseConfirmOpen(false);
                onClose();
              }}
              disabled={isPending}
              className="w-full px-3 py-2 rounded-md text-sm font-medium text-red-300 border border-red-500/30 bg-red-500/5 hover:bg-red-500/15 disabled:opacity-50 transition-colors"
            >
              Descartar alterações
            </button>
            <button
              onClick={() => setCloseConfirmOpen(false)}
              disabled={isPending}
              className="w-full px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:bg-white/5 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

/* ─── World Template Gallery ─────────────────────────────────────────────── */

function WorldTemplateGallery({
  stationId,
  currentMapData,
  onApplied,
}: {
  stationId: string;
  currentMapData: Partial<WorldMapData> | null;
  onApplied: () => void;
}) {
  const [search, setSearch] = useState("");
  const [applying, setApplying] = useState<string | null>(null);
  const { data, isLoading } = useListWorldTemplates({ search: search || undefined });
  const { mutateAsync: applyTemplate } = useApplyWorldTemplate();

  const templates = (data?.templates ?? []) as {
    id: string; name: string; description?: string | null;
    previewUrl?: string | null; usedCount: number; category: string;
    author: { name: string | null; image?: string | null };
  }[];

  async function handleApply(templateId: string) {
    // Resumo do conteúdo atual pra alertar antes de sobrescrever
    const objs = currentMapData?.placedObjects?.length ?? 0;
    const ars = currentMapData?.areas?.length ?? 0;
    const tiles = currentMapData?.tileLayer
      ? Object.keys(currentMapData.tileLayer.cells ?? {}).length
      : 0;
    const hasContent = objs > 0 || ars > 0 || tiles > 0;

    const message = hasContent
      ? `⚠️ Você está prestes a SUBSTITUIR seu mundo atual:\n\n` +
        `  • ${objs} objeto(s) colocado(s)\n` +
        `  • ${ars} área(s)\n` +
        `  • ${tiles} tile(s) pintado(s)\n\n` +
        `Tudo isso será PERDIDO e não pode ser desfeito.\n\nContinuar?`
      : "Aplicar este template vai substituir o mapa atual. Continuar?";

    if (!confirm(message)) return;
    setApplying(templateId);
    try {
      await applyTemplate({ templateId, stationId });
      onApplied();
    } catch {
      alert("Erro ao aplicar o template.");
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">🌍 Templates da Comunidade</p>
        <p className="text-xs text-slate-600">Mundos criados pela comunidade NASA</p>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar templates..."
        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
      />

      {isLoading && (
        <div className="text-center py-8 text-slate-500 text-xs">Carregando templates...</div>
      )}

      {!isLoading && templates.length === 0 && (
        <div className="text-center py-8 text-slate-500 text-sm">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
          Nenhum template público encontrado.
          <p className="text-xs text-slate-600 mt-1">Crie um mundo e publique para a comunidade!</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-white/10 overflow-hidden">
            {t.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.previewUrl} alt={t.name} className="w-full h-28 object-cover" />
            ) : (
              <div className="w-full h-28 bg-indigo-900/20 flex items-center justify-center text-4xl">🗺️</div>
            )}
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{t.name}</p>
                  <p className="text-[10px] text-slate-400">{t.author.name} · {t.usedCount} usos</p>
                  {t.description && (
                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{t.description}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => handleApply(t.id)}
                  disabled={applying === t.id}
                  className="shrink-0 text-xs bg-indigo-600 hover:bg-indigo-500"
                >
                  {applying === t.id ? "..." : "Usar"}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Tiled Map Section ──────────────────────────────────────────────────── */

/* ─── Catálogo de Mapas Tiled ────────────────────────────────────────────── */

export interface MapPreset {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: string;
  url: string;
  baseUrl: string;
  source: "WorkAdventure" | "Phaser" | "Community";
  license: string;
  tags: string[];
  /** Cor de fundo do card de preview */
  bg: string;
  /** Cor de destaque (acentos, badges, gradiente) */
  accent: string;
  /** URL de thumbnail real (opcional — fallback é emoji + gradiente) */
  previewUrl?: string;
}

// Todos os URLs abaixo seguem o padrão raw.githubusercontent e retornam JSON Tiled (type:"map").
// Catálogo inspirado no repositório oficial do WorkAdventure (workadventure/workadventure)
// e na galeria maps.workadventu.re — cobrindo escritório, coworking, conferência, educação,
// social, evento, natureza e demo/tutorial.
export const MAP_PRESETS: MapPreset[] = [
  /* ── Escritório ───────────────────────────────────────────────────────── */
  {
    id: "wa-starter-kit",
    name: "Starter Kit",
    description: "Mapa padrão do WorkAdventure — ponto de partida oficial com sala central",
    emoji: "🏠",
    category: "Escritório",
    url: "https://raw.githubusercontent.com/workadventure/map-starter-kit/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/workadventure/map-starter-kit/master/",
    source: "WorkAdventure",
    license: "MIT",
    tags: ["starter", "template", "workadventure"],
    bg: "#0f1a24", accent: "#38bdf8",
    previewUrl: "https://raw.githubusercontent.com/workadventure/map-starter-kit/master/office.png",
  },
  {
    id: "wa-office",
    name: "WA Internal",
    description: "Escritório interno do WorkAdventure — open space e salas de reunião",
    emoji: "🏢",
    category: "Escritório",
    url: "https://raw.githubusercontent.com/workadventure/wa-internal-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/workadventure/wa-internal-map/master/",
    source: "WorkAdventure",
    license: "MIT",
    tags: ["office", "corporate", "workadventure"],
    bg: "#101829", accent: "#6366f1",
    previewUrl: "https://raw.githubusercontent.com/workadventure/wa-internal-map/master/map.png",
  },
  {
    id: "wa-office-complete",
    name: "Office Complete",
    description: "Escritório completo 2 andares — recepção, salas, copa e terraço",
    emoji: "🏙️",
    category: "Escritório",
    url: "https://raw.githubusercontent.com/workadventure/office-complete-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/workadventure/office-complete-map/master/",
    source: "WorkAdventure",
    license: "MIT",
    tags: ["office", "complete", "multi-floor"],
    bg: "#0d1a1f", accent: "#14b8a6",
    previewUrl: "https://raw.githubusercontent.com/workadventure/map-starter-kit/master/office.png",
  },
  {
    id: "wa-ubirch",
    name: "Ubirch HQ",
    description: "Sede da Ubirch — corredor central com salas laterais e área de descanso",
    emoji: "🏬",
    category: "Escritório",
    url: "https://raw.githubusercontent.com/ubirch/workadventure_map/master/floor.json",
    baseUrl: "https://raw.githubusercontent.com/ubirch/workadventure_map/master/",
    source: "WorkAdventure",
    license: "Community",
    tags: ["office", "hq", "workadventure"],
    bg: "#1a0e24", accent: "#a855f7",
    previewUrl: "https://raw.githubusercontent.com/workadventure/wa-internal-map/master/map.png",
  },
  {
    id: "wa-mobizel",
    name: "Mobizel Studio",
    description: "Estúdio criativo — layout loft com áreas colaborativas e sala de café",
    emoji: "🎨",
    category: "Escritório",
    url: "https://raw.githubusercontent.com/mobizel/workadventure-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/mobizel/workadventure-map/master/",
    source: "WorkAdventure",
    license: "Community",
    tags: ["studio", "creative", "workadventure"],
    bg: "#24140a", accent: "#f97316",
    previewUrl: "https://raw.githubusercontent.com/workadventure/agency/master/map.png",
  },
  {
    id: "wa-gutefrage",
    name: "Gutefrage Office",
    description: "Open space moderno — mesas em cluster, copa e sala de reunião",
    emoji: "🛋️",
    category: "Escritório",
    url: "https://raw.githubusercontent.com/gutefrage/workadventure-maps/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/gutefrage/workadventure-maps/master/",
    source: "WorkAdventure",
    license: "Community",
    tags: ["office", "open-space", "workadventure"],
    bg: "#0f1f14", accent: "#22c55e",
    previewUrl: "https://raw.githubusercontent.com/workadventure/map-starter-kit/master/office.png",
  },
  {
    id: "wa-jibograf",
    name: "Jibograf HQ",
    description: "Sede compacta — corredores e salas temáticas integradas",
    emoji: "🏗️",
    category: "Escritório",
    url: "https://raw.githubusercontent.com/jibograf/workadventure-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/jibograf/workadventure-map/master/",
    source: "Community",
    license: "Community",
    tags: ["office", "compact", "workadventure"],
    bg: "#231a0e", accent: "#eab308",
    previewUrl: "https://raw.githubusercontent.com/workadventure/wa-internal-map/master/map.png",
  },

  /* ── Coworking ────────────────────────────────────────────────────────── */
  {
    id: "wa-bitwaescherei",
    name: "Bitwäscherei",
    description: "Hackspace colaborativo com zonas temáticas e área de projetos",
    emoji: "💻",
    category: "Coworking",
    url: "https://raw.githubusercontent.com/DigitaleGesellschaft/workadventure-map-bitwaescherei/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/DigitaleGesellschaft/workadventure-map-bitwaescherei/master/",
    source: "Community",
    license: "Community",
    tags: ["hackspace", "coworking", "community"],
    bg: "#0a1724", accent: "#3b82f6",
    previewUrl: "https://raw.githubusercontent.com/workadventure/game-room/master/map.png",
  },
  {
    id: "wa-async",
    name: "Async Agency",
    description: "Agência digital com salas de projetos, war room e área recreativa",
    emoji: "⚡",
    category: "Coworking",
    url: "https://raw.githubusercontent.com/AsyncAgency/WorkAdventure/main/map.json",
    baseUrl: "https://raw.githubusercontent.com/AsyncAgency/WorkAdventure/main/",
    source: "Community",
    license: "Community",
    tags: ["agency", "digital", "coworking"],
    bg: "#1f0a24", accent: "#d946ef",
    previewUrl: "https://raw.githubusercontent.com/workadventure/agency/master/map.png",
  },
  {
    id: "wa-peterkirn",
    name: "Create Digital",
    description: "Estúdio de música e tecnologia criativa — espaço colaborativo aberto",
    emoji: "🎵",
    category: "Coworking",
    url: "https://raw.githubusercontent.com/peterkirn/workadventure-maps/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/peterkirn/workadventure-maps/master/",
    source: "Community",
    license: "Community",
    tags: ["music", "studio", "creative"],
    bg: "#1f140a", accent: "#fb923c",
    previewUrl: "https://raw.githubusercontent.com/workadventure/agency/master/map.png",
  },
  {
    id: "wa-cafe",
    name: "Café Coworking",
    description: "Café colaborativo — mesas redondas, balcão e área de networking",
    emoji: "☕",
    category: "Coworking",
    url: "https://raw.githubusercontent.com/workadventure/cafe-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/workadventure/cafe-map/master/",
    source: "WorkAdventure",
    license: "Community",
    tags: ["cafe", "coworking", "social"],
    bg: "#231408", accent: "#b45309",
    previewUrl: "https://raw.githubusercontent.com/workadventure/wa-village/master/map.png",
  },

  /* ── Conferência ──────────────────────────────────────────────────────── */
  {
    id: "wa-conference",
    name: "Conference Hall",
    description: "Grande salão de conferências com palco central e auditório",
    emoji: "🎤",
    category: "Conferência",
    url: "https://raw.githubusercontent.com/workadventure/conference-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/workadventure/conference-map/master/",
    source: "WorkAdventure",
    license: "MIT",
    tags: ["conference", "auditorium", "event"],
    bg: "#140a24", accent: "#8b5cf6",
    previewUrl: "https://raw.githubusercontent.com/workadventure/map-starter-kit/master/conference.png",
  },
  {
    id: "wa-summit",
    name: "Tech Summit",
    description: "Múltiplas salas de palestras, expo area e lounge de networking",
    emoji: "🎙️",
    category: "Conferência",
    url: "https://raw.githubusercontent.com/workadventure/summit-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/workadventure/summit-map/master/",
    source: "WorkAdventure",
    license: "MIT",
    tags: ["summit", "conference", "tech"],
    bg: "#0a1424", accent: "#0ea5e9",
    previewUrl: "https://raw.githubusercontent.com/workadventure/map-starter-kit/master/conference.png",
  },
  {
    id: "wa-expo",
    name: "Expo Center",
    description: "Centro de exposições — estandes, palco e áreas demo",
    emoji: "🏛️",
    category: "Conferência",
    url: "https://raw.githubusercontent.com/workadventure/expo-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/workadventure/expo-map/master/",
    source: "Community",
    license: "Community",
    tags: ["expo", "exhibition", "event"],
    bg: "#241014", accent: "#f43f5e",
    previewUrl: "https://raw.githubusercontent.com/workadventure/wa-village/master/map.png",
  },

  /* ── Educação ─────────────────────────────────────────────────────────── */
  {
    id: "wa-classroom",
    name: "Classroom",
    description: "Sala de aula clássica — carteiras, quadro e biblioteca integrada",
    emoji: "🏫",
    category: "Educação",
    url: "https://raw.githubusercontent.com/workadventure/classroom-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/workadventure/classroom-map/master/",
    source: "WorkAdventure",
    license: "MIT",
    tags: ["school", "classroom", "education"],
    bg: "#14240e", accent: "#84cc16",
    previewUrl: "https://raw.githubusercontent.com/workadventure/classroom/master/map.png",
  },
  {
    id: "wa-university",
    name: "Campus Universitário",
    description: "Campus com salas de aula, laboratórios, biblioteca e refeitório",
    emoji: "🎓",
    category: "Educação",
    url: "https://raw.githubusercontent.com/workadventure/university-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/workadventure/university-map/master/",
    source: "Community",
    license: "Community",
    tags: ["university", "campus", "education"],
    bg: "#0e1424", accent: "#6366f1",
    previewUrl: "https://raw.githubusercontent.com/workadventure/ecole-3a/master/map.png",
  },
  {
    id: "wa-library",
    name: "Biblioteca",
    description: "Biblioteca silenciosa com estantes, mesas de estudo e sala de leitura",
    emoji: "📚",
    category: "Educação",
    url: "https://raw.githubusercontent.com/workadventure/library-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/workadventure/library-map/master/",
    source: "Community",
    license: "Community",
    tags: ["library", "study", "education"],
    bg: "#1a1408", accent: "#d97706",
    previewUrl: "https://raw.githubusercontent.com/workadventure/classroom/master/map.png",
  },

  /* ── Social ───────────────────────────────────────────────────────────── */
  {
    id: "wa-village",
    name: "Village",
    description: "Vila aberta com praça, lojas e áreas de encontro — a vila oficial do WA",
    emoji: "🏘️",
    category: "Social",
    url: "https://raw.githubusercontent.com/workadventure/map-main-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/workadventure/map-main-map/master/",
    source: "WorkAdventure",
    license: "MIT",
    tags: ["village", "social", "main"],
    bg: "#142008", accent: "#65a30d",
    previewUrl: "https://raw.githubusercontent.com/workadventure/wa-village/master/map.png",
  },
  {
    id: "wa-island",
    name: "Ilha Tropical",
    description: "Ilha paradisíaca — praia, coqueiros e cabanas para encontros descontraídos",
    emoji: "🏝️",
    category: "Social",
    url: "https://raw.githubusercontent.com/workadventure/island-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/workadventure/island-map/master/",
    source: "Community",
    license: "Community",
    tags: ["beach", "tropical", "social"],
    bg: "#082024", accent: "#06b6d4",
    previewUrl: "https://raw.githubusercontent.com/workadventure/chillin-at-the-beach/master/map.png",
  },
  {
    id: "wa-plaza",
    name: "Praça Central",
    description: "Praça urbana com chafariz, bancos e cafés ao redor — encontros casuais",
    emoji: "⛲",
    category: "Social",
    url: "https://raw.githubusercontent.com/workadventure/plaza-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/workadventure/plaza-map/master/",
    source: "Community",
    license: "Community",
    tags: ["plaza", "urban", "social"],
    bg: "#0f1a24", accent: "#2563eb",
    previewUrl: "https://raw.githubusercontent.com/workadventure/wa-village/master/map.png",
  },

  /* ── Evento ───────────────────────────────────────────────────────────── */
  {
    id: "wa-party",
    name: "Festa Noturna",
    description: "Pista de dança com DJ booth, bar e áreas chill para party",
    emoji: "🎉",
    category: "Evento",
    url: "https://raw.githubusercontent.com/workadventure/party-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/workadventure/party-map/master/",
    source: "Community",
    license: "Community",
    tags: ["party", "nightlife", "event"],
    bg: "#240a1f", accent: "#ec4899",
    previewUrl: "https://raw.githubusercontent.com/workadventure/game-room/master/map.png",
  },
  {
    id: "wa-wedding",
    name: "Cerimônia",
    description: "Cerimônia com altar, cadeiras e área de recepção — celebrações",
    emoji: "💐",
    category: "Evento",
    url: "https://raw.githubusercontent.com/workadventure/wedding-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/workadventure/wedding-map/master/",
    source: "Community",
    license: "Community",
    tags: ["wedding", "ceremony", "event"],
    bg: "#201418", accent: "#f472b6",
    previewUrl: "https://raw.githubusercontent.com/workadventure/map-starter-kit/master/conference.png",
  },

  /* ── Natureza ─────────────────────────────────────────────────────────── */
  {
    id: "wa-forest",
    name: "Floresta Encantada",
    description: "Caminhos na floresta, clareira central e cachoeira — reuniões ao ar livre",
    emoji: "🌲",
    category: "Natureza",
    url: "https://raw.githubusercontent.com/workadventure/forest-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/workadventure/forest-map/master/",
    source: "Community",
    license: "Community",
    tags: ["forest", "nature", "outdoor"],
    bg: "#0a1f0f", accent: "#16a34a",
    previewUrl: "https://raw.githubusercontent.com/workadventure/chillin-at-the-beach/master/map.png",
  },
  {
    id: "wa-mountain",
    name: "Refúgio na Montanha",
    description: "Chalé rústico entre montanhas com lareira e deck panorâmico",
    emoji: "⛰️",
    category: "Natureza",
    url: "https://raw.githubusercontent.com/workadventure/mountain-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/workadventure/mountain-map/master/",
    source: "Community",
    license: "Community",
    tags: ["mountain", "cabin", "retreat"],
    bg: "#14180e", accent: "#a3a3a3",
    previewUrl: "https://raw.githubusercontent.com/workadventure/wa-village/master/map.png",
  },

  /* ── Demo / Tutorial ──────────────────────────────────────────────────── */
  {
    id: "wa-tutorial",
    name: "Tutorial WA",
    description: "Mapa interativo que ensina as mecânicas do WorkAdventure passo a passo",
    emoji: "📖",
    category: "Demo",
    url: "https://raw.githubusercontent.com/workadventure/tutorial-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/workadventure/tutorial-map/master/",
    source: "WorkAdventure",
    license: "MIT",
    tags: ["tutorial", "demo", "learning"],
    bg: "#0e1a24", accent: "#38bdf8",
    previewUrl: "https://raw.githubusercontent.com/workadventure/map-starter-kit/master/office.png",
  },
  {
    id: "wa-masterclass",
    name: "Masterclass",
    description: "Exemplo oficial com todas as features — zonas, jitsi, quizzes, portais",
    emoji: "🎯",
    category: "Demo",
    url: "https://raw.githubusercontent.com/workadventure/masterclass-map/master/map.json",
    baseUrl: "https://raw.githubusercontent.com/workadventure/masterclass-map/master/",
    source: "WorkAdventure",
    license: "MIT",
    tags: ["masterclass", "demo", "features"],
    bg: "#1a1424", accent: "#a78bfa",
    previewUrl: "https://raw.githubusercontent.com/workadventure/wa-internal-map/master/map.png",
  },
];

/* ─── Categorias para filtro ─────────────────────────────────────────────── */
const MAP_CATEGORIES = [
  "Todos",
  "Escritório",
  "Coworking",
  "Conferência",
  "Educação",
  "Social",
  "Evento",
  "Natureza",
  "Demo",
] as const;
type MapCategory = typeof MAP_CATEGORIES[number];

/* ─── Seção Modelos de Mapas ─────────────────────────────────────────────── */
function MapPresetsSection({ onApply, activeUrl }: { onApply: (preset: MapPreset) => void; activeUrl: string }) {
  const [filter, setFilter] = useState<MapCategory>("Todos");

  const filtered = filter === "Todos"
    ? MAP_PRESETS
    : MAP_PRESETS.filter(p => p.category === filter);

  return (
    <div className="space-y-3 pt-2 border-t border-white/10">
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">🗺️ Modelos de Mapas</p>
        <p className="text-xs text-slate-600">
          {MAP_PRESETS.length} mapas Tiled do WorkAdventure — clique para aplicar
        </p>
      </div>

      {/* Filtro de categoria */}
      <div className="flex gap-1.5 flex-wrap">
        {MAP_CATEGORIES.map(cat => {
          const count = cat === "Todos"
            ? MAP_PRESETS.length
            : MAP_PRESETS.filter(p => p.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                filter === cat
                  ? "bg-indigo-600 text-white"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
              }`}
            >
              {cat} <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Grid de mapas — card idêntico ao de cenários de mundo */}
      <div className="grid grid-cols-2 gap-2">
        {filtered.map(preset => {
          const isActive = activeUrl === preset.url;
          return (
            <button
              key={preset.id}
              onClick={() => onApply(preset)}
              className={`relative text-left rounded-xl border overflow-hidden transition-all group ${
                isActive
                  ? "border-indigo-500 ring-2 ring-indigo-500/40"
                  : "border-white/10 hover:border-white/30"
              }`}
            >
              {/* ── Preview image area ── */}
              <div className="relative h-28 overflow-hidden">
                {/* Imagem real pixel-art do mapa WA */}
                {preset.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preset.previewUrl}
                    alt={preset.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                {/* Gradient overlay para legibilidade */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: preset.previewUrl
                      ? `linear-gradient(to bottom, ${preset.accent}18 0%, ${preset.bg}f0 100%)`
                      : `radial-gradient(ellipse at 60% 35%, ${preset.accent}44 0%, ${preset.bg} 75%)`,
                  }}
                />
                {/* Dot pattern só sem imagem */}
                {!preset.previewUrl && (
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{ backgroundImage: `radial-gradient(${preset.accent} 1px, transparent 1px)`, backgroundSize: "12px 12px" }}
                  />
                )}
                {/* Emoji centralizado */}
                <span className="absolute inset-0 flex items-center justify-center text-3xl drop-shadow-lg z-10">
                  {preset.emoji}
                </span>
                {/* Badge de categoria */}
                <span
                  className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full z-20"
                  style={{
                    background: `${preset.accent}30`,
                    color: preset.accent,
                    border: `1px solid ${preset.accent}55`,
                    backdropFilter: "blur(6px)",
                  }}
                >
                  {preset.category}
                </span>
                {isActive && (
                  <span className="absolute top-1.5 left-1.5 z-20">
                    <Check className="h-3.5 w-3.5 text-indigo-400 drop-shadow" />
                  </span>
                )}
              </div>
              {/* ── Info ── */}
              <div className="px-2.5 py-2" style={{ background: `${preset.bg}ee` }}>
                <p className="text-xs font-semibold text-white leading-tight truncate">{preset.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight line-clamp-2">{preset.description}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-slate-500">{preset.source}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-6 text-slate-500 text-xs">
          Nenhum mapa nesta categoria
        </div>
      )}
    </div>
  );
}

/* ─── Seção Mapa Personalizado ───────────────────────────────────────────── */
function TiledMapSection({
  currentTiledUrl,
  onApply,
}: {
  currentTiledUrl: string;
  onApply: (url: string, base: string) => void;
}) {
  const [url, setUrl] = useState(currentTiledUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [valid, setValid] = useState<boolean | null>(null);

  async function handleLoad(targetUrl: string) {
    setLoading(true);
    setError(null);
    setValid(null);
    const trimmed = targetUrl.trim();
    const base = trimmed.substring(0, trimmed.lastIndexOf("/") + 1);
    const meta = await fetchTiledMeta(trimmed, base);
    setLoading(false);
    if (!meta) {
      setError("URL inválida ou não é um mapa Tiled JSON (.tmj)");
      setValid(false);
    } else {
      setValid(true);
      onApply(trimmed, base);
    }
  }

  async function handleFileUpload(file: File) {
    setError(null);
    setValid(null);
    let json: unknown;
    try { json = JSON.parse(await file.text()); } catch { setError("Arquivo inválido — não é JSON"); return; }
    if ((json as Record<string, unknown>).type !== "map") {
      setError("Arquivo não é um mapa Tiled válido");
      return;
    }
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload-local", { method: "POST", body: form });
      const data = await res.json() as { url?: string };
      if (!data.url) throw new Error("Sem URL retornada");
      const uploadedUrl = data.url;
      setUrl(uploadedUrl);
      setLoading(false);
      setValid(true);
      onApply(uploadedUrl, "");
    } catch {
      setLoading(false);
      setError("Falha ao enviar arquivo");
    }
  }

  return (
    <div className="space-y-3 pt-2 border-t border-white/10">
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">📁 Mapa Personalizado (Tiled)</p>
        <p className="text-xs text-slate-600">Insira uma URL ou envie seu próprio arquivo .tmj</p>
      </div>

      {/* URL Input */}
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setValid(null); setError(null); }}
          placeholder="https://...mapa.tmj"
          className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
        />
        <Button
          size="sm"
          onClick={() => handleLoad(url)}
          disabled={loading || !url.trim()}
          className="shrink-0 text-xs"
        >
          {loading ? "..." : "Carregar"}
        </Button>
      </div>

      {/* File Upload */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="file"
          accept=".tmj,.json"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
        />
        <span className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/20 hover:border-white/40 transition-colors text-xs text-slate-400">
          📁 Enviar arquivo .tmj
        </span>
      </label>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
      {valid && (
        <div className="flex items-center gap-2 text-xs text-green-400">
          <Check className="h-3.5 w-3.5 shrink-0" />
          Mapa Tiled carregado com sucesso!
        </div>
      )}
    </div>
  );
}
