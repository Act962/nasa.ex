"use client";

/**
 * WokaAvatarPanel
 * Painel de personalização de avatar estilo Work Adventure.
 * Mostra preview animado (canvas 3×4 spritesheet 32×32) + grade de seleção.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Shuffle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AvatarConfig } from "../../types";

/* ─── Tipos ─────────────────────────────────────────────────────────────────── */
interface WokaTexture {
  id: string;
  name: string;
  url: string;
}

interface WokaCollection {
  name: string;
  textures: WokaTexture[];
}

type BodyPart = "body";

interface WokaData {
  body: WokaCollection[];
}

/* ─── Assets Pipoya ──────────────────────────────────────────────────────────── */
function buildPipoyaCollection(): WokaData {
  const femaleTextures: WokaTexture[] = [];
  const maleTextures: WokaTexture[] = [];

  // Female 01-1 até 25-1 + variantes 2-4 para 01-22
  for (let i = 1; i <= 25; i++) {
    const id = String(i).padStart(2, "0");
    femaleTextures.push({ id: `female-${id}-1`, name: `Female ${id}`, url: `/woka/pipoya/Female ${id}-1.png` });
  }
  for (let i = 1; i <= 22; i++) {
    const id = String(i).padStart(2, "0");
    for (let v = 2; v <= 4; v++) {
      femaleTextures.push({ id: `female-${id}-${v}`, name: `Female ${id}-${v}`, url: `/woka/pipoya/Female ${id}-${v}.png` });
    }
  }

  for (let i = 1; i <= 25; i++) {
    const id = String(i).padStart(2, "0");
    maleTextures.push({ id: `male-${id}-1`, name: `Male ${id}`, url: `/woka/pipoya/Male ${id}-1.png` });
  }
  for (let i = 1; i <= 17; i++) {
    const id = String(i).padStart(2, "0");
    for (let v = 2; v <= 4; v++) {
      maleTextures.push({ id: `male-${id}-${v}`, name: `Male ${id}-${v}`, url: `/woka/pipoya/Male ${id}-${v}.png` });
    }
  }

  return {
    body: [
      { name: "Feminino", textures: femaleTextures },
      { name: "Masculino", textures: maleTextures },
    ],
  };
}

const WOKA_DATA = buildPipoyaCollection();

/* ─── Canvas Preview ─────────────────────────────────────────────────────────── */
// Spritesheet: 3 cols × 4 rows de 32×32px
// rows: 0=down, 1=left, 2=right, 3=up
const FRAME_W = 32;
const FRAME_H = 32;
const WALK_FRAMES = [0, 1, 2]; // 3 frames por row
const DIRECTIONS = [0, 1, 3, 2]; // down, left, up, right

function WokaPreviewCanvas({ url, direction, canvasSize = 130 }: {
  url: string | null;
  direction: number;  // 0-3
  canvasSize?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);
  const frameRef  = useRef(0);
  const rafRef    = useRef<number>(0);
  const tickRef   = useRef(0);

  useEffect(() => {
    if (!url) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { imgRef.current = img; };
    img.src = url;
    return () => { imgRef.current = null; };
  }, [url]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    const animate = () => {
      ctx.clearRect(0, 0, canvasSize, canvasSize);
      const img = imgRef.current;
      if (img) {
        tickRef.current++;
        if (tickRef.current % 8 === 0) {
          frameRef.current = (frameRef.current + 1) % 3;
        }
        const row = direction;
        const col = WALK_FRAMES[frameRef.current];
        ctx.drawImage(img,
          col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H,
          0, 0, canvasSize, canvasSize
        );
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [url, direction, canvasSize]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize}
      height={canvasSize}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

/* ─── Thumbnail ──────────────────────────────────────────────────────────────── */
function WokaThumbnail({ url, selected, onClick }: {
  url: string;
  selected: boolean;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.clearRect(0, 0, 48, 48);
      // Draw idle frame (col 1, row 0 = front facing)
      ctx.drawImage(img, FRAME_W, 0, FRAME_W, FRAME_H, 0, 0, 48, 48);
    };
    img.src = url;
  }, [url]);

  return (
    <button
      onClick={onClick}
      className={`
        relative rounded-xl border-2 transition-all overflow-hidden bg-slate-800
        flex items-center justify-center
        ${selected
          ? "border-indigo-400 shadow-md shadow-indigo-500/30 scale-105"
          : "border-transparent hover:border-slate-500"}
      `}
      style={{ width: 64, height: 64 }}
    >
      <canvas
        ref={canvasRef}
        width={48}
        height={48}
        style={{ imageRendering: "pixelated" }}
      />
    </button>
  );
}

/* ─── Props ──────────────────────────────────────────────────────────────────── */
interface Props {
  avatarConfig?: AvatarConfig;
  onChange: (partial: Partial<AvatarConfig>) => void;
  onClose: () => void;
}

/* ─── Componente Principal ───────────────────────────────────────────────────── */
export function WokaAvatarPanel({ avatarConfig, onChange, onClose }: Props) {
  const allTextures = WOKA_DATA.body.flatMap(c => c.textures);

  const initialUrl = avatarConfig?.lpcSpritesheetUrl &&
    !avatarConfig.lpcSpritesheetUrl.startsWith("pixel_") &&
    !avatarConfig.lpcSpritesheetUrl.startsWith("http") &&
    avatarConfig.lpcSpritesheetUrl.includes("pipoya")
    ? avatarConfig.lpcSpritesheetUrl
    : allTextures[0].url;

  const [selectedUrl, setSelectedUrl] = useState<string>(initialUrl);
  const [dirIdx, setDirIdx] = useState(0);

  const handleSelect = (url: string) => setSelectedUrl(url);

  const handleRandomize = useCallback(() => {
    const rand = allTextures[Math.floor(Math.random() * allTextures.length)];
    setSelectedUrl(rand.url);
  }, [allTextures]);

  const handleFinish = () => {
    onChange({ lpcSpritesheetUrl: selectedUrl, lpcCharacterName: undefined });
    onClose();
  };

  const handleReset = () => {
    onChange({ lpcSpritesheetUrl: undefined, lpcCharacterName: undefined });
    onClose();
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1f2e] text-white rounded-2xl overflow-hidden">
      <div className="flex flex-1 overflow-hidden">

        {/* ── Painel esquerdo: Preview ───────────────────────────────────── */}
        <div className="w-56 flex-shrink-0 flex flex-col items-center gap-4 p-6 border-r border-white/10">
          {/* Canvas preview */}
          <div className="w-32 h-32 rounded-2xl bg-white/10 flex items-center justify-center overflow-hidden">
            <WokaPreviewCanvas
              url={selectedUrl}
              direction={DIRECTIONS[dirIdx]}
              canvasSize={128}
            />
          </div>

          {/* Botão rotacionar */}
          <button
            onClick={() => setDirIdx(d => (d + 1) % 4)}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            title="Girar personagem"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-300" />
          </button>

          {/* Botão randomizar */}
          <Button
            variant="outline"
            onClick={handleRandomize}
            className="w-full border-white/20 bg-white/5 hover:bg-white/10 text-white gap-2 mt-2"
          >
            <Shuffle className="h-4 w-4" />
            Randomizar
          </Button>
        </div>

        {/* ── Painel direito: Seleção ────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar fixa */}
          <div className="flex border-b border-white/10 px-4 pt-3 gap-1 flex-shrink-0">
            <div className="pb-2 border-b-2 border-white text-sm font-semibold text-white px-2">
              Personagem
            </div>
          </div>

          {/* Grid de texturas */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5" style={{
            maskImage: "linear-gradient(to bottom, black 85%, transparent 100%)",
          }}>
            {WOKA_DATA.body.map(collection => (
              <div key={collection.name}>
                <p className="text-xs text-slate-400 mb-3 font-medium">{collection.name}</p>
                <div className="flex flex-wrap gap-2">
                  {collection.textures.map(tex => (
                    <WokaThumbnail
                      key={tex.id}
                      url={tex.url}
                      selected={selectedUrl === tex.url}
                      onClick={() => handleSelect(tex.url)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Rodapé ──────────────────────────────────────────────────────── */}
      <div className="flex gap-3 p-4 border-t border-white/10">
        <Button
          variant="ghost"
          onClick={handleReset}
          className="flex-1 text-slate-400 hover:text-white hover:bg-white/5"
        >
          Voltar ao personagem padrão
        </Button>
        <Button
          onClick={handleFinish}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
        >
          Terminar
        </Button>
      </div>
    </div>
  );
}