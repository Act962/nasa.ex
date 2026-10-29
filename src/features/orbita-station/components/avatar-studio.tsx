"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StationEngine } from "../engine/station-engine";
import type { StudioPreview } from "../engine/studio-preview";
import type { CharacterRegion } from "../engine/thumbnail-stage";
import { LOOK_OPTIONS, type AvatarLook } from "../lib/avatar-look";
import { STUDIO_BACKGROUNDS, STUDIO_POSES, readStudioPreferences, writeStudioPreferences, type StudioPreferences } from "../lib/studio-preferences";

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

// Miniatura de cada opção: o próprio personagem vestindo a opção, enquadrado na parte do corpo que ela muda.
// No rosto, sem capacete, para o cabelo aparecer.
const THUMBNAIL_FRAMING: Record<ChoiceField, { region: CharacterRegion; preview?: Partial<AvatarLook> }> = {
  face: { region: "head", preview: { helmet: "sem" } },
  top: { region: "top" },
  bottom: { region: "bottom" },
  cape: { region: "back" },
  helmet: { region: "head" },
};
const THUMBNAILS_PER_TICK = 3;

/** Desenha as miniaturas aos poucos: o painel aparece na hora e as imagens chegam em seguida. */
function useOptionThumbnails(engine: StationEngine, look: AvatarLook) {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  useEffect(() => {
    const requests = (Object.keys(THUMBNAIL_FRAMING) as ChoiceField[]).flatMap((field) =>
      LOOK_OPTIONS[field].map(([key]) => ({ id: `${field}:${key}`, look: { ...look, [field]: key, ...THUMBNAIL_FRAMING[field].preview }, region: THUMBNAIL_FRAMING[field].region })),
    );
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const batch = requests.splice(0, THUMBNAILS_PER_TICK);
      const painted = Object.fromEntries(batch.flatMap((request) => {
        const image = engine.characterThumbnail(request.look as AvatarLook, request.region);
        return image ? [[request.id, image]] : [];
      }));
      setThumbnails((previous) => ({ ...previous, ...painted }));
      if (requests.length) timer = setTimeout(step, 0);
    };
    timer = setTimeout(step, 0);
    return () => clearTimeout(timer);
  }, [engine, look]);
  return thumbnails;
}

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
  const [preferences, setPreferences] = useState<StudioPreferences>(readStudioPreferences);
  const thumbnails = useOptionThumbnails(engine, look);
  const background = STUDIO_BACKGROUNDS.find((option) => option.key === preferences.background) ?? STUDIO_BACKGROUNDS[0];

  useEffect(() => {
    const preview = engine.openStudio(stageRef.current!, initialLook);
    preview?.setPose(readStudioPreferences().pose);
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

  const changePreferences = (patch: Partial<StudioPreferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    writeStudioPreferences(next);
    if (patch.pose) previewRef.current?.setPose(patch.pose);
  };

  const change = (patch: Partial<AvatarLook>) => {
    const next = { ...look, ...patch };
    setLook(next);
    previewRef.current?.setLook(next);
  };

  return (
    <div role="dialog" aria-label="Estúdio do personagem" className="absolute inset-0 z-20 grid bg-black/80 backdrop-blur-sm md:grid-cols-[1fr_380px]">
      <div className="relative min-h-[40dvh]" style={{ background: background.css }}>
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
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60">Cena</h3>
            <div className="space-y-2">
              <p className="text-sm">Fundo</p>
              <div className="flex flex-wrap gap-2">
                {STUDIO_BACKGROUNDS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    title={option.label}
                    aria-label={option.label}
                    aria-pressed={preferences.background === option.key}
                    onClick={() => changePreferences({ background: option.key })}
                    className={cn("size-8 rounded-full border-2 border-white/20 transition", preferences.background === option.key && "border-white ring-2 ring-white/40")}
                    style={{ background: option.css }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm">Pose</p>
              <div className="flex flex-wrap gap-2">
                {STUDIO_POSES.map((option) => (
                  <Button
                    key={option.clip}
                    size="sm"
                    variant={preferences.pose === option.clip ? "default" : "secondary"}
                    aria-pressed={preferences.pose === option.clip}
                    onClick={() => changePreferences({ pose: option.clip })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </section>
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
                    <div className="grid grid-cols-3 gap-2">
                      {LOOK_OPTIONS[entry.field].map(([key, label]) => {
                        const thumbnail = thumbnails[`${entry.field}:${key}`];
                        const isPressed = look[entry.field] === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            aria-pressed={isPressed}
                            onClick={() => change({ [entry.field]: key })}
                            className={cn("overflow-hidden rounded-xl border-2 bg-white/5 text-left text-xs transition hover:bg-white/10", isPressed ? "border-white" : "border-transparent")}
                          >
                            <div className="aspect-[4/3] w-full">
                              {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada no navegador (data URL) */}
                              {thumbnail && <img src={thumbnail} alt="" className="h-full w-full object-cover" />}
                            </div>
                            <span className="block truncate px-2 py-1">{label}</span>
                          </button>
                        );
                      })}
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
