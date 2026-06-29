"use client";

/**
 * ScenarioEditor — define o cenário do mundo dentro do Map Editor.
 *
 * Migrado da aba "Cenário" do WorldSettingsPanel pra ficar junto das
 * outras configs do mapa (áreas, objetos, tiles, room config). 3 caminhos:
 *   1. 🖼️ Imagem (recomendado): user sobe uma imagem
 *   2. 📐 Modelo de mundo: cards pré-definidos (station, lab, mars…)
 *   3. 🛠️ Mapa Tiled (avançado): URL de .tmj
 */

import { useState } from "react";
import { Image as ImageIcon, Loader2, Upload, Trash2 } from "lucide-react";
import { useUpdateWorld } from "../../../hooks/use-station";
import type {
  StationWorldConfig,
  WorldMapData,
  ScenarioType,
} from "../../../types";

interface Props {
  stationId: string;
  worldConfig: StationWorldConfig;
  /** Aplica preview imediato no canvas Phaser (não persiste). */
  onWorldConfigChange?: (next: StationWorldConfig) => void;
}

interface ScenarioCard {
  id: ScenarioType;
  emoji: string;
  label: string;
}

const SCENARIO_CARDS: ScenarioCard[] = [
  { id: "station",         emoji: "🚀", label: "Estação" },
  { id: "space",           emoji: "🌌", label: "Espaço" },
  { id: "rocket",          emoji: "🚀", label: "Foguete" },
  { id: "lunar_base",      emoji: "🌙", label: "Base lunar" },
  { id: "mission_control", emoji: "🛰️", label: "Mission Control" },
  { id: "lab",             emoji: "🧪", label: "Laboratório" },
  { id: "hangar",          emoji: "🛩️", label: "Hangar" },
  { id: "mars",            emoji: "🔴", label: "Marte" },
  { id: "observatory",     emoji: "🔭", label: "Observatório" },
  { id: "bridge",          emoji: "⚓", label: "Ponte" },
];

export function ScenarioEditor({
  stationId,
  worldConfig,
  onWorldConfigChange,
}: Props) {
  const raw = (worldConfig.mapData as WorldMapData | null) ?? null;
  const [scenario, setScenarioLocal] = useState<ScenarioType>(
    raw?.scenario ?? "station",
  );
  const [bgImageUrl, setBgImageUrl] = useState<string>(
    raw?.backgroundImageUrl ?? "",
  );
  const [bgImageWidth, setBgImageWidth] = useState<number | undefined>(
    raw?.backgroundImageWidth,
  );
  const [bgImageHeight, setBgImageHeight] = useState<number | undefined>(
    raw?.backgroundImageHeight,
  );
  const [tiledMapUrl, setTiledMapUrl] = useState<string>(
    raw?.tiledMapUrl ?? "",
  );
  const [tiledBaseUrl, setTiledBaseUrl] = useState<string>(
    raw?.tiledBaseUrl ?? "",
  );
  const [bgUploading, setBgUploading] = useState(false);
  const [bgUploadError, setBgUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { mutateAsync: updateWorld } = useUpdateWorld();

  function buildMapData(patch: Partial<WorldMapData>): WorldMapData {
    const previous = (raw ?? {}) as Partial<WorldMapData>;
    return {
      scenario,
      gameView: previous.gameView ?? "aerial",
      elements: previous.elements ?? ({} as WorldMapData["elements"]),
      rooms: previous.rooms ?? [],
      meetingRoomCount: previous.meetingRoomCount ?? 2,
      selectedAssets: previous.selectedAssets,
      tiledMapUrl: tiledMapUrl || undefined,
      tiledBaseUrl: tiledBaseUrl || undefined,
      backgroundImageUrl: bgImageUrl || undefined,
      backgroundImageWidth: bgImageWidth,
      backgroundImageHeight: bgImageHeight,
      // Preserva trabalho do Map Editor (objetos, áreas, tiles, sala)
      placedObjects: previous.placedObjects,
      areas: previous.areas,
      tileLayer: previous.tileLayer,
      roomConfig: previous.roomConfig,
      ...patch,
    };
  }

  function applyPreview(nextMapData: WorldMapData) {
    onWorldConfigChange?.({
      ...worldConfig,
      mapData: nextMapData as unknown as StationWorldConfig["mapData"],
    });
  }

  async function persist(nextMapData: WorldMapData) {
    setSaving(true);
    try {
      await updateWorld({ stationId, mapData: nextMapData });
    } catch (err) {
      console.error("[ScenarioEditor] save error:", err);
    } finally {
      setSaving(false);
    }
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
      const res = await fetch("/api/upload-local", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!data.url) throw new Error(data.error ?? "Sem URL retornada");
      const img = new window.Image();
      const dim = await new Promise<{ w: number; h: number }>(
        (resolve, reject) => {
          img.onload = () =>
            resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => reject(new Error("Imagem inválida"));
          img.src = data.url!;
        },
      );
      setBgImageUrl(data.url);
      setBgImageWidth(dim.w);
      setBgImageHeight(dim.h);
      setScenarioLocal("image");
      const next = buildMapData({
        scenario: "image",
        backgroundImageUrl: data.url,
        backgroundImageWidth: dim.w,
        backgroundImageHeight: dim.h,
      });
      applyPreview(next);
      void persist(next);
    } catch (e) {
      setBgUploadError(`Falha: ${(e as Error).message}`);
    } finally {
      setBgUploading(false);
    }
  }

  function pickScenario(id: ScenarioType) {
    setScenarioLocal(id);
    const next = buildMapData({ scenario: id });
    applyPreview(next);
    void persist(next);
  }

  function removeBgImage() {
    setBgImageUrl("");
    setBgImageWidth(undefined);
    setBgImageHeight(undefined);
    const fallback: ScenarioType =
      scenario === "image" ? "station" : scenario;
    setScenarioLocal(fallback);
    const next = buildMapData({
      scenario: fallback,
      backgroundImageUrl: undefined,
      backgroundImageWidth: undefined,
      backgroundImageHeight: undefined,
    });
    applyPreview(next);
    void persist(next);
  }

  function handleTiledApply() {
    if (!tiledMapUrl) return;
    setScenarioLocal("tiled");
    const next = buildMapData({ scenario: "tiled" });
    applyPreview(next);
    void persist(next);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-5 pt-5 pb-3 border-b border-white/5">
        <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-indigo-400" />
          Cenário
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Defina o fundo do mundo: imagem, modelo pré-feito ou mapa Tiled.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* ── 1) Imagem (recomendado) ────────────────────────────── */}
        <section
          className={`rounded-xl border p-4 space-y-3 transition-colors ${
            scenario === "image"
              ? "border-indigo-500/60 bg-indigo-500/5"
              : "border-white/10 bg-slate-900/40"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-indigo-300 uppercase tracking-wider mb-0.5">
                🖼️ Imagem (recomendado)
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Suba uma imagem (cena, foto, pixel-art) e o avatar anda em cima
                dela. Use Áreas → Colisão pra bloquear sofá / parede / móvel.
              </p>
            </div>
            {scenario === "image" && (
              <span className="text-[10px] text-indigo-400 font-bold uppercase">
                Ativo
              </span>
            )}
          </div>

          {bgImageUrl && (
            <div className="rounded-md overflow-hidden border border-white/10 bg-slate-950/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bgImageUrl}
                alt="Cenário"
                className="w-full max-h-40 object-contain"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <label
              className={`flex-1 cursor-pointer text-center text-xs font-medium px-3 py-2 rounded-md border ${
                bgUploading
                  ? "border-white/10 bg-slate-800/40 text-slate-500 cursor-not-allowed"
                  : "border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-200"
              }`}
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                {bgUploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                {bgUploading
                  ? "Enviando..."
                  : bgImageUrl
                    ? "Trocar imagem"
                    : "Selecionar imagem"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={bgUploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleBgImageUpload(f);
                }}
              />
            </label>
            {bgImageUrl && (
              <button
                type="button"
                onClick={removeBgImage}
                className="text-xs text-red-300 hover:text-red-200 px-3 py-2 rounded-md border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 inline-flex items-center gap-1"
                title="Remover imagem"
              >
                <Trash2 className="h-3 w-3" />
                Remover
              </button>
            )}
          </div>

          {bgImageUrl && (
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                  Largura (px)
                </span>
                <input
                  type="number"
                  min={64}
                  value={bgImageWidth ?? ""}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || undefined;
                    setBgImageWidth(v);
                    applyPreview(
                      buildMapData({ backgroundImageWidth: v }),
                    );
                  }}
                  className="w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 tabular-nums"
                />
              </label>
              <label className="block">
                <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                  Altura (px)
                </span>
                <input
                  type="number"
                  min={64}
                  value={bgImageHeight ?? ""}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || undefined;
                    setBgImageHeight(v);
                    applyPreview(
                      buildMapData({ backgroundImageHeight: v }),
                    );
                  }}
                  className="w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 tabular-nums"
                />
              </label>
            </div>
          )}

          {bgUploadError && (
            <p className="text-[11px] text-red-400">{bgUploadError}</p>
          )}
        </section>

        {/* ── 2) Modelos de Mundo ────────────────────────────────── */}
        <section className="space-y-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            📐 Modelos de mundo
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SCENARIO_CARDS.map((c) => {
              const active = scenario === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickScenario(c.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-colors ${
                    active
                      ? "border-indigo-400/60 bg-indigo-500/10 text-indigo-200"
                      : "border-white/10 hover:border-white/30 hover:bg-white/5 text-slate-300"
                  }`}
                >
                  <span className="text-base">{c.emoji}</span>
                  <span className="font-medium">{c.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 3) Tiled (avançado) ─────────────────────────────────── */}
        <details className="rounded-xl border border-white/10 bg-slate-900/40 group">
          <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider list-none flex items-center justify-between">
            <span>🛠️ Mapa Tiled (avançado)</span>
            <span className="text-[10px] text-slate-600 group-open:hidden">
              expandir
            </span>
          </summary>
          <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
            <label className="block">
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                URL do .tmj
              </span>
              <input
                value={tiledMapUrl}
                onChange={(e) => setTiledMapUrl(e.target.value)}
                placeholder="https://.../map.tmj"
                className="w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                URL base (tilesets)
              </span>
              <input
                value={tiledBaseUrl}
                onChange={(e) => setTiledBaseUrl(e.target.value)}
                placeholder="https://.../tilesets/"
                className="w-full px-2 py-1.5 rounded-md bg-slate-800/60 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </label>
            <button
              type="button"
              onClick={handleTiledApply}
              disabled={!tiledMapUrl || saving}
              className="w-full text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-3 py-2 rounded-md transition-colors"
            >
              {scenario === "tiled" ? "Re-aplicar" : "Aplicar"}
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
