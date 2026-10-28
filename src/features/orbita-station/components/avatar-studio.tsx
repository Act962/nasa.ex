"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StationEngine } from "../engine/station-engine";
import type { StudioPreview } from "../engine/studio-preview";
import { LOOK_OPTIONS, type AvatarLook } from "../lib/avatar-look";

type ColorField = "skin" | "hairColor" | "suit" | "accent" | "outfitColor";
type ChoiceField = "face" | "helmet" | "top" | "bottom" | "cape";

const SECTIONS: { title: string; fields: ({ kind: "color"; field: ColorField; label: string } | { kind: "choice"; field: ChoiceField; label: string })[] }[] = [
  {
    title: "Corpo",
    fields: [
      { kind: "color", field: "skin", label: "Pele" },
      { kind: "choice", field: "face", label: "Rosto e cabelo" },
      { kind: "color", field: "hairColor", label: "Cor do cabelo" },
    ],
  },
  {
    title: "Roupa",
    fields: [
      { kind: "choice", field: "top", label: "Parte de cima" },
      { kind: "choice", field: "bottom", label: "Parte de baixo" },
      { kind: "choice", field: "cape", label: "Por cima" },
      { kind: "color", field: "outfitColor", label: "Cor da roupa" },
    ],
  },
  {
    title: "Traje Órbita e acessórios",
    fields: [
      { kind: "choice", field: "helmet", label: "Na cabeça" },
      { kind: "color", field: "suit", label: "Cor do traje" },
      { kind: "color", field: "accent", label: "Cor do neon" },
    ],
  },
];

// Swatch de "cor original" da roupa: mistura das cores do pacote.
const ORIGINAL_SWATCH = "conic-gradient(#e0832f, #2fa36b, #1469ff, #c23b3b, #e0832f)";

interface AvatarStudioProps {
  engine: StationEngine;
  initialLook: AvatarLook;
  onSave: (look: AvatarLook) => void;
  onClose: () => void;
}

export function AvatarStudio({ engine, initialLook, onSave, onClose }: AvatarStudioProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<StudioPreview | null>(null);
  const [look, setLook] = useState(initialLook);

  useEffect(() => {
    const preview = engine.openStudio(stageRef.current!, initialLook);
    previewRef.current = preview;
    return () => {
      preview?.dispose();
      previewRef.current = null;
    };
  }, [engine, initialLook]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const change = (patch: Partial<AvatarLook>) => {
    const next = { ...look, ...patch };
    setLook(next);
    previewRef.current?.setLook(next);
  };

  return (
    <div role="dialog" aria-label="Estúdio do personagem" className="absolute inset-0 z-20 grid bg-black/80 backdrop-blur-sm md:grid-cols-[1fr_380px]">
      <div className="relative min-h-[40dvh]">
        <div ref={stageRef} className="absolute inset-0" />
        <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-white/60">
          Arraste para girar o personagem
        </p>
      </div>
      <div className="flex min-h-0 flex-col border-white/10 bg-black/60 md:border-l">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 p-4">
          <h2 className="text-lg font-semibold">Seu personagem</h2>
          <Button size="icon" variant="ghost" aria-label="Fechar o estúdio" onClick={onClose}>
            <X />
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
          {SECTIONS.map((section) => (
            <section key={section.title} className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60">{section.title}</h3>
              {section.fields.map((entry) => (
                <div key={entry.field} className="space-y-2">
                  <p className="text-sm">{entry.label}</p>
                  {entry.kind === "color" ? (
                    <div className="flex flex-wrap gap-2">
                      {LOOK_OPTIONS[entry.field].map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={color === "original" ? "Cores originais" : color}
                          aria-pressed={look[entry.field] === color}
                          onClick={() => change({ [entry.field]: color })}
                          className={cn(
                            "size-8 rounded-full border-2 border-white/20 transition",
                            look[entry.field] === color && "border-white ring-2 ring-white/40",
                          )}
                          style={{ background: color === "original" ? ORIGINAL_SWATCH : color }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {LOOK_OPTIONS[entry.field].map(([key, label]) => (
                        <Button
                          key={key}
                          size="sm"
                          variant={look[entry.field] === key ? "default" : "secondary"}
                          aria-pressed={look[entry.field] === key}
                          onClick={() => change({ [entry.field]: key })}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </section>
          ))}
        </div>
        <div className="flex gap-2 border-t border-white/10 p-4">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={() => onSave(look)}>
            <Check /> Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
