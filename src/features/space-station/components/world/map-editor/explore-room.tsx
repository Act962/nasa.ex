"use client";

/**
 * ExploreRoom — "Explorar a sala".
 * Mini-mapa de visão geral + controles de zoom (fit / reset).
 * Emite eventos para o Phaser: space-station:zoom-fit / :zoom-reset / :camera-pan.
 */

import { useEffect, useState } from "react";
import { Maximize2, ZoomIn, ZoomOut, Compass, Target } from "lucide-react";
import type { PlacedMapObject, MapArea } from "../../../types";
import { AREA_TYPE_META } from "../../../types";

interface Props {
  placedObjects: PlacedMapObject[];
  areas:         MapArea[];
  /** Tamanho do mundo em pixels — expomos para escalar o mini-mapa */
  worldWidth?:   number;
  worldHeight?:  number;
}

export function ExploreRoom({
  placedObjects, areas,
  worldWidth = 2400, worldHeight = 1350,
}: Props) {
  const [cam, setCam] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  /** Recebe atualizações do viewport do Phaser para desenhar a "janela" no mini-mapa */
  useEffect(() => {
    const onView = (e: Event) => {
      const d = (e as CustomEvent).detail as { x: number; y: number; w: number; h: number };
      setCam(d);
    };
    window.addEventListener("space-station:camera-view", onView);
    // pede uma amostra inicial
    window.dispatchEvent(new CustomEvent("space-station:request-camera-view"));
    return () => window.removeEventListener("space-station:camera-view", onView);
  }, []);

  // dimensão do mini-mapa: cabe em 280px
  const MAX = 280;
  const ratio = Math.min(MAX / worldWidth, MAX / worldHeight);
  const mapW = worldWidth  * ratio;
  const mapH = worldHeight * ratio;

  function jumpTo(ev: React.MouseEvent<HTMLDivElement>) {
    const rect = ev.currentTarget.getBoundingClientRect();
    const x = (ev.clientX - rect.left) / rect.width  * worldWidth;
    const y = (ev.clientY - rect.top)  / rect.height * worldHeight;
    window.dispatchEvent(new CustomEvent("space-station:camera-pan", { detail: { x, y } }));
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-5 pt-5 pb-3 border-b border-white/5">
        <h2 className="text-lg font-semibold text-white tracking-tight">Explorar a sala</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Visão geral do mapa. Clique para mover a câmera.
        </p>
      </div>

      {/* ─── Controles ─── */}
      <div className="px-5 pt-3 pb-3 grid grid-cols-2 gap-2">
        <Btn
          icon={<Maximize2 className="h-3.5 w-3.5" />}
          label="Ajustar à sala"
          onClick={() => window.dispatchEvent(new CustomEvent("space-station:zoom-fit"))}
        />
        <Btn
          icon={<Target className="h-3.5 w-3.5" />}
          label="Voltar ao centro"
          onClick={() => window.dispatchEvent(new CustomEvent("space-station:zoom-reset"))}
        />
        <Btn
          icon={<ZoomIn className="h-3.5 w-3.5" />}
          label="Aproximar"
          onClick={() => window.dispatchEvent(new CustomEvent("space-station:zoom-in"))}
        />
        <Btn
          icon={<ZoomOut className="h-3.5 w-3.5" />}
          label="Afastar"
          onClick={() => window.dispatchEvent(new CustomEvent("space-station:zoom-out"))}
        />
      </div>

      {/* ─── Mini-mapa ─── */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-1.5">
          <Compass className="h-3 w-3 text-indigo-400" />
          Mini-mapa
        </div>
        <div
          onClick={jumpTo}
          className="relative rounded-lg border border-white/10 bg-slate-800/40 overflow-hidden cursor-crosshair mx-auto"
          style={{ width: mapW, height: mapH }}
          title="Clique para mover a câmera até aqui"
        >
          {/* Áreas */}
          {areas.map(a => {
            const meta = AREA_TYPE_META[a.type] ?? { label: a.type as string, emoji: "🏷️", color: "#94a3b8", description: "" };
            const color = a.color ?? meta.color;
            return (
              <div
                key={a.id}
                className="absolute rounded-sm"
                style={{
                  left:   a.x * ratio,
                  top:    a.y * ratio,
                  width:  a.w * ratio,
                  height: a.h * ratio,
                  backgroundColor: color + "44",
                  border: `1px solid ${color}`,
                }}
                title={a.name}
              />
            );
          })}
          {/* Objetos como pontos */}
          {placedObjects.map(o => (
            <div
              key={o.id}
              className="absolute w-1.5 h-1.5 rounded-full bg-indigo-300 border border-indigo-600"
              style={{
                left: o.x * ratio - 3,
                top:  o.y * ratio - 3,
              }}
              title={o.name}
            />
          ))}
          {/* Viewport atual da câmera */}
          {cam && (
            <div
              className="absolute border-2 border-amber-300/90 bg-amber-300/10 pointer-events-none"
              style={{
                left:   cam.x * ratio,
                top:    cam.y * ratio,
                width:  cam.w * ratio,
                height: cam.h * ratio,
              }}
            />
          )}
        </div>

        {/* ─── Estatísticas ─── */}
        <div className="mt-5 grid grid-cols-2 gap-2 text-center">
          <Stat label="Objetos" value={placedObjects.length} />
          <Stat label="Áreas"   value={areas.length} />
        </div>

        {/* ─── Lista de áreas (atalho) ─── */}
        {areas.length > 0 && (
          <div className="mt-5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
              Ir para área
            </div>
            <div className="space-y-1">
              {areas.map(a => {
                const meta = AREA_TYPE_META[a.type] ?? { label: a.type as string, emoji: "🏷️", color: "#94a3b8", description: "" };
                return (
                  <button
                    key={a.id}
                    onClick={() => window.dispatchEvent(new CustomEvent("space-station:camera-pan", {
                      detail: { x: a.x + a.w / 2, y: a.y + a.h / 2 },
                    }))}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left border border-transparent hover:border-white/10 hover:bg-white/5 transition-colors"
                  >
                    <span className="text-base">{meta.emoji}</span>
                    <span className="text-xs text-white flex-1 truncate">{a.name}</span>
                    <span className="text-[10px] text-slate-500 tabular-nums">
                      {Math.round(a.x)},{Math.round(a.y)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Btn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-2 rounded-md bg-slate-800/60 hover:bg-slate-700/60 border border-white/10 text-xs text-slate-200 transition-colors"
    >
      <span className="text-indigo-300">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-slate-800/40 py-2">
      <div className="text-xl font-bold text-white tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}
