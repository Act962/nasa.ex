"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Check } from "lucide-react";

type Handle = "move" | "tl" | "tr" | "bl" | "br";

interface Crop { x: number; y: number; w: number; h: number }

interface DragState {
  mode: Handle;
  startCrop: Crop;
  startX: number;
  startY: number;
  containerW: number;
  containerH: number;
}

interface Props {
  src: string;
  initialCrop?: Crop;
  onApply: (crop: Crop | undefined) => void;
  onClose: () => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const MIN = 0.04;

export function ImageCropEditor({ src, initialCrop, onApply, onClose }: Props) {
  const [crop, setCrop] = useState<Crop>(initialCrop ?? { x: 0, y: 0, w: 1, h: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / d.containerW;
      const dy = (e.clientY - d.startY) / d.containerH;
      const s = d.startCrop;
      setCrop(() => {
        switch (d.mode) {
          case "move":
            return { ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) };
          case "tl": {
            const nx = clamp(s.x + dx, 0, s.x + s.w - MIN);
            const ny = clamp(s.y + dy, 0, s.y + s.h - MIN);
            return { x: nx, y: ny, w: s.w + (s.x - nx), h: s.h + (s.y - ny) };
          }
          case "tr": {
            const ny = clamp(s.y + dy, 0, s.y + s.h - MIN);
            return { x: s.x, y: ny, w: clamp(s.w + dx, MIN, 1 - s.x), h: s.h + (s.y - ny) };
          }
          case "bl": {
            const nx = clamp(s.x + dx, 0, s.x + s.w - MIN);
            return { x: nx, y: s.y, w: s.w + (s.x - nx), h: clamp(s.h + dy, MIN, 1 - s.y) };
          }
          case "br":
            return { ...s, w: clamp(s.w + dx, MIN, 1 - s.x), h: clamp(s.h + dy, MIN, 1 - s.y) };
        }
      });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const startDrag = (e: React.PointerEvent, mode: Handle) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    dragRef.current = {
      mode,
      startCrop: { ...crop },
      startX: e.clientX,
      startY: e.clientY,
      containerW: rect.width,
      containerH: rect.height,
    };
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card rounded-xl shadow-2xl flex flex-col w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">Cortar imagem</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 bg-zinc-900 flex justify-center items-center overflow-hidden" style={{ minHeight: 200 }}>
          <div
            ref={containerRef}
            style={{ position: "relative", display: "inline-block", maxWidth: "100%", lineHeight: 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              style={{ display: "block", maxWidth: "100%", maxHeight: "58vh", userSelect: "none" }}
              draggable={false}
            />

            {/* Dark overlays outside crop */}
            {[
              { top: 0, left: 0, right: 0, height: `${crop.y * 100}%` },
              { top: `${(crop.y + crop.h) * 100}%`, left: 0, right: 0, bottom: 0 },
              { top: `${crop.y * 100}%`, left: 0, width: `${crop.x * 100}%`, height: `${crop.h * 100}%` },
              { top: `${crop.y * 100}%`, left: `${(crop.x + crop.w) * 100}%`, right: 0, height: `${crop.h * 100}%` },
            ].map((s, i) => (
              <div key={i} style={{ position: "absolute", background: "rgba(0,0,0,0.58)", pointerEvents: "none", ...s }} />
            ))}

            {/* Crop rectangle */}
            <div
              onPointerDown={(e) => startDrag(e, "move")}
              style={{
                position: "absolute",
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
                border: "2px solid rgba(255,255,255,0.9)",
                cursor: "move",
                boxSizing: "border-box",
              }}
            >
              {/* Rule-of-thirds grid */}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div style={{ borderRight: "1px solid rgba(255,255,255,0.22)" }} />
                <div style={{ borderRight: "1px solid rgba(255,255,255,0.22)" }} />
                <div />
              </div>
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "grid", gridTemplateRows: "1fr 1fr 1fr" }}>
                <div style={{ borderBottom: "1px solid rgba(255,255,255,0.22)" }} />
                <div style={{ borderBottom: "1px solid rgba(255,255,255,0.22)" }} />
                <div />
              </div>

              {/* Corner handles */}
              {(["tl", "tr", "bl", "br"] as const).map((h) => (
                <div
                  key={h}
                  onPointerDown={(e) => { e.stopPropagation(); startDrag(e, h); }}
                  style={{
                    position: "absolute",
                    width: 14, height: 14,
                    background: "white",
                    border: "2px solid #6366f1",
                    borderRadius: 3,
                    cursor: h === "tl" || h === "br" ? "nwse-resize" : "nesw-resize",
                    ...(h === "tl" ? { top: -6, left: -6 }
                       : h === "tr" ? { top: -6, right: -6 }
                       : h === "bl" ? { bottom: -6, left: -6 }
                       :              { bottom: -6, right: -6 }),
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center px-4 py-3 border-t">
          <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => onApply(undefined)}>
            Remover corte
          </Button>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button size="sm" className="gap-1" onClick={() => onApply(crop)}>
              <Check size={13} />
              Aplicar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
