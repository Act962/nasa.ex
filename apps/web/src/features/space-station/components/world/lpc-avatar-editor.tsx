"use client";

/**
 * LpcAvatarEditor
 *
 * Painel de personalização de avatar pixel art estilo arcade.
 * Oferece:
 *   1. Astronautas pré-gerados em 4 cores (seleção rápida)
 *   2. Upload de spritesheet customizado (via LPC Generator externo)
 *   3. Preview animado do personagem selecionado (canvas loop)
 */

import { useRef, useState, useCallback, useEffect } from "react";
import {
  Upload, ExternalLink, CheckCircle2, Loader2,
  RefreshCw, Trash2, Info, Sparkles,
} from "lucide-react";
import Image from "next/image";
import type { AvatarConfig } from "../../types";

/* ─── Constantes LPC ────────────────────────────────────────────────────────── */
export const LPC_FRAME_SIZE  = 64;
export const LPC_WALK_ROW_S  = 8;
export const LPC_WALK_ROW_W  = 9;
export const LPC_WALK_ROW_N  = 10;
export const LPC_WALK_ROW_E  = 11;
export const LPC_WALK_FRAMES = 9;

const LPC_GENERATOR_URL =
  "https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/";

/* ─── Spritesheets pré-gerados ──────────────────────────────────────────────── */
const PRESET_CHARACTERS = [
  {
    id:     "pixel",
    label:  "Meu Astronauta",
    url:    "pixel_astronaut",   // valor especial → composição de foto no visor
    accent: "#60a5fa",
    bg:     "#0a1628",
    badge:  "📸",               // indica que usa foto de perfil
  },
  {
    id:    "blue",
    label: "Capitão Azul",
    url:   "/lpc_astronaut.png",
    accent: "#3278d7",
    bg:     "#0d1b3e",
  },
  {
    id:    "orange",
    label: "Pioneiro Solar",
    url:   "/lpc_astronaut_orange.png",
    accent: "#e85a10",
    bg:     "#2a1000",
  },
  {
    id:    "green",
    label: "Bio-Ranger",
    url:   "/lpc_astronaut_green.png",
    accent: "#1ea040",
    bg:     "#041a0a",
  },
  {
    id:    "red",
    label: "Comandante",
    url:   "/lpc_astronaut_red.png",
    accent: "#cc1e1e",
    bg:     "#200404",
  },
] as const;

type PresetId = typeof PRESET_CHARACTERS[number]["id"];

interface Props {
  avatarConfig?: AvatarConfig;
  onChange:      (partial: Partial<AvatarConfig>) => void;
  stationId:     string;
  /** Se true, renderiza apenas o canvas de preview sem os controles */
  previewOnly?:  boolean;
}

type UploadState = "idle" | "uploading" | "done" | "error";

/* ─── Preview animado do frame idle ────────────────────────────────────────── */
function LpcPreviewCanvas({ url, scale = 4 }: { url: string; scale?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef  = useRef(0);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const F = LPC_FRAME_SIZE;
    const W = F * scale;
    const H = F * scale;
    canvas.width  = W;
    canvas.height = H;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let tick = 0;
      const loop = () => {
        tick++;
        // Cycle through walk-south frames 1-8 at ~8fps
        if (tick % 8 === 0) {
          frameRef.current = (frameRef.current % 8) + 1;
        }
        const col = frameRef.current;
        const row = LPC_WALK_ROW_S;

        ctx.clearRect(0, 0, W, H);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          img,
          col * F, row * F, F, F,   // source
          0,       0,        W, H,   // dest
        );
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    };
    img.src = url;

    return () => cancelAnimationFrame(rafRef.current);
  }, [url, scale]);

  return (
    <canvas
      ref={canvasRef}
      style={{ imageRendering: "pixelated", display: "block" }}
    />
  );
}

/* ─── Componente principal ──────────────────────────────────────────────────── */
export function LpcAvatarEditor({ avatarConfig, onChange, stationId, previewOnly }: Props) {
  // Determine current selection
  const currentUrl  = avatarConfig?.lpcSpritesheetUrl;
  const currentName = avatarConfig?.lpcCharacterName ?? "";
  const presetMatch = PRESET_CHARACTERS.find(p => currentUrl?.includes(p.url.replace("/","").replace(".png","") ));

  const [selectedPreset, setSelectedPreset] = useState<PresetId | "custom" | null>(
    presetMatch?.id ?? (currentUrl ? "custom" : null)
  );
  const [customUrl,    setCustomUrl]    = useState<string | null>(
    (!presetMatch && currentUrl) ? currentUrl : null
  );
  const [charName,     setCharName]     = useState(currentName);
  const [uploadState,  setUploadState]  = useState<UploadState>("idle");
  const [dragOver,     setDragOver]     = useState(false);
  const [errorMsg,     setErrorMsg]     = useState("");
  const [showGuide,    setShowGuide]    = useState(false);
  const [showUpload,   setShowUpload]   = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeUrl = selectedPreset === "custom"
    ? customUrl
    : PRESET_CHARACTERS.find(p => p.id === selectedPreset)?.url ?? null;

  const activePreset = PRESET_CHARACTERS.find(p => p.id === selectedPreset);

  /* ── Preview only mode ─────────────────────────────────────────────────── */
  if (previewOnly) {
    const previewUrl = currentUrl
      ? (PRESET_CHARACTERS.find(p => currentUrl.includes(p.url.replace("/","").replace(".png","")))?.url === "pixel_astronaut"
          ? "/lpc_pixel_astronaut.png"
          : currentUrl)
      : "/lpc_astronaut.png";
    return (
      <div style={{ width: 64, height: 64, imageRendering: "pixelated" }}>
        <LpcPreviewCanvas url={previewUrl} scale={1} />
      </div>
    );
  }

  /* ── Selecionar preset ────────────────────────────────────────────────── */
  const selectPreset = (preset: typeof PRESET_CHARACTERS[number]) => {
    setSelectedPreset(preset.id);
    const name = charName || preset.label;
    setCharName(name);
    onChange({
      lpcSpritesheetUrl: preset.url,
      lpcCharacterName:  name,
    });
  };

  /* ── Upload para S3 ─────────────────────────────────────────────────── */
  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Arquivo deve ser uma imagem PNG.");
      setUploadState("error");
      return;
    }
    setUploadState("uploading");
    setErrorMsg("");
    try {
      const signRes = await fetch("/api/s3/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: `lpc-avatar-${stationId}-${Date.now()}.png`,
          contentType: file.type,
          folder: "lpc-avatars",
        }),
      });
      if (!signRes.ok) throw new Error("Falha ao obter URL de upload");
      const { uploadUrl, publicUrl } = await signRes.json() as { uploadUrl: string; publicUrl: string };

      const upRes = await fetch(uploadUrl, {
        method: "PUT", headers: { "Content-Type": file.type }, body: file,
      });
      if (!upRes.ok) throw new Error("Falha no upload para S3");

      setCustomUrl(publicUrl);
      setSelectedPreset("custom");
      setUploadState("done");
      const name = charName || file.name.replace(/\.[^.]+$/, "");
      setCharName(name);
      onChange({ lpcSpritesheetUrl: publicUrl, lpcCharacterName: name });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro no upload");
      setUploadState("error");
    }
  }, [stationId, charName, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0]; if (f) uploadFile(f);
  }, [uploadFile]);

  const handleRemove = () => {
    setSelectedPreset(null); setCustomUrl(null); setUploadState("idle");
    onChange({ lpcSpritesheetUrl: undefined, lpcCharacterName: undefined });
  };

  return (
    <div className="flex flex-col gap-4">

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-400" />
          <h3 className="text-white font-semibold text-sm">Personagem Pixel Art</h3>
        </div>
        <button
          onClick={() => setShowGuide(g => !g)}
          className="text-slate-500 hover:text-slate-300 transition-colors"
          title="Informações"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Guia ──────────────────────────────────────────────────────── */}
      {showGuide && (
        <div className="text-[11px] text-slate-400 bg-slate-800/60 rounded-xl px-3 py-2.5 leading-relaxed">
          Escolha um astronauta pré-pronto ou crie o seu no gerador LPC e faça o upload do PNG.
          O personagem substitui o astronauta SVG no mundo — com animação de caminhada em 4 direções.
        </div>
      )}

      {/* ── Preview + nome ────────────────────────────────────────────── */}
      {activeUrl && (
        <div
          className="flex items-center gap-4 rounded-2xl p-3 border border-white/10"
          style={{ background: activePreset ? `${activePreset.bg}cc` : "#0f172acc" }}
        >
          <div
            className="rounded-xl overflow-hidden flex-shrink-0"
            style={{
              width: LPC_FRAME_SIZE * 3,
              height: LPC_FRAME_SIZE * 3,
              imageRendering: "pixelated",
              background: "rgba(0,0,0,0.3)",
            }}
          >
            <LpcPreviewCanvas url={activeUrl} scale={3} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
              <span className="text-xs text-emerald-400 font-semibold">Ativo</span>
            </div>
            <input
              type="text"
              value={charName}
              onChange={e => {
                setCharName(e.target.value);
                onChange({ lpcCharacterName: e.target.value });
              }}
              className="w-full bg-transparent text-white text-sm font-semibold focus:outline-none border-b border-white/10 focus:border-indigo-400 pb-0.5 mb-2"
              placeholder="Nome do personagem"
            />
            <div className="flex flex-wrap gap-1 mb-2">
              {["walk ↓","walk ←","walk ↑","walk →"].map(a => (
                <span key={a}
                  className="text-[9px] px-1.5 py-0.5 rounded border border-white/10 text-slate-400">
                  {a}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleRemove}
                className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors">
                <Trash2 className="h-3 w-3" /> Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Grid de presets ───────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-semibold text-slate-500 tracking-widest uppercase mb-2">
          Astronautas pré-prontos
        </p>
        <div className="grid grid-cols-4 gap-2">
          {PRESET_CHARACTERS.map(preset => {
            const isActive = selectedPreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => selectPreset(preset)}
                className={`
                  relative flex flex-col items-center gap-1.5 pt-3 pb-2 rounded-xl border transition-all
                  ${isActive
                    ? "border-indigo-400 shadow-lg shadow-indigo-500/20"
                    : "border-white/10 hover:border-white/25"}
                `}
                style={isActive ? { background: `${preset.bg}dd` } : { background: "#ffffff08" }}
              >
                {isActive && (
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-400" />
                )}
                <div
                  className="relative overflow-hidden rounded-lg"
                  style={{
                    width: LPC_FRAME_SIZE * 1.5,
                    height: LPC_FRAME_SIZE * 1.5,
                    imageRendering: "pixelated",
                    background: "rgba(0,0,0,0.35)",
                  }}
                >
                  <LpcPreviewCanvas
                    url={preset.url === "pixel_astronaut" ? "/lpc_pixel_astronaut.png" : preset.url}
                    scale={1.5}
                  />
                  {"badge" in preset && (
                    <span className="absolute bottom-1 right-1 text-sm leading-none">{preset.badge}</span>
                  )}
                </div>
                <span
                  className="text-[10px] font-semibold leading-tight text-center px-1"
                  style={{ color: isActive ? preset.accent : "#94a3b8" }}
                >
                  {preset.label}
                </span>
                {"badge" in preset && (
                  <span className="text-[9px] text-sky-400 leading-tight text-center px-1">foto no visor</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Upload customizado (colapsável) ───────────────────────────── */}
      <div>
        <button
          onClick={() => setShowUpload(v => !v)}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors w-full"
        >
          <div className="flex-1 h-px bg-white/8" />
          <span>{showUpload ? "▲" : "▼"} Usar meu próprio personagem</span>
          <div className="flex-1 h-px bg-white/8" />
        </button>

        {showUpload && (
          <div className="mt-3 flex flex-col gap-3">
            <a
              href={LPC_GENERATOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold py-2 rounded-xl transition-all border border-indigo-500/30"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir LPC Generator (nova aba)
            </a>

            {/* Drag & drop */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                flex flex-col items-center justify-center gap-2 py-5
                border-2 border-dashed rounded-xl cursor-pointer transition-all
                ${dragOver
                  ? "border-indigo-400 bg-indigo-950/30"
                  : "border-white/10 hover:border-white/20 bg-white/[0.02]"}
              `}
            >
              {uploadState === "uploading" ? (
                <><Loader2 className="h-5 w-5 text-indigo-400 animate-spin" />
                  <span className="text-xs text-slate-400">Enviando...</span></>
              ) : uploadState === "done" ? (
                <><CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="text-xs text-emerald-400">Upload concluído!</span></>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-slate-400" />
                  <span className="text-xs text-white font-medium text-center">
                    {dragOver ? "Solte aqui!" : "Arraste o PNG do LPC Generator"}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    64×64 por frame · formato LPC padrão
                  </span>
                </>
              )}
              {uploadState === "error" && (
                <p className="text-xs text-rose-400">{errorMsg}</p>
              )}
            </div>

            {selectedPreset === "custom" && customUrl && (
              <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 rounded-lg px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                <span className="truncate">{customUrl.split("/").pop()}</span>
                <button onClick={() => fileInputRef.current?.click()}
                  className="ml-auto text-indigo-400 hover:text-indigo-300 flex-shrink-0">
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef} type="file" accept="image/png" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }}
      />

      <p className="text-[10px] text-slate-700 text-center">
        Astronautas pré-prontos gerados com assets originais NASA Agents · livre para uso interno
      </p>
    </div>
  );
}
