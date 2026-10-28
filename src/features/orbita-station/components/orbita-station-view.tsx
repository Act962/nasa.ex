"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Map as MapIcon, Minus, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { StationEngine, WebGLUnavailableError } from "../engine/station-engine";
import { STATION_TEMPLATES } from "../layout/station-templates";
import type { AvatarLook } from "../lib/avatar-look";
import { hasSavedAvatarLook, readAvatarLook, readTemplateKey, saveAvatarLook, saveTemplateKey } from "../lib/station-preferences";
import { useOrbitaStationStore } from "../store/use-orbita-station-store";
import { AvatarStudio } from "./avatar-studio";
import { StationMapLabels } from "./station-map-labels";
import { TouchJoystick } from "./touch-joystick";

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || target.closest("input, select, textarea") !== null);

export function OrbitaStationView({ userId }: { userId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<StationEngine | null>(null);
  const [readyEngine, setReadyEngine] = useState<StationEngine | null>(null);
  const [studioLook, setStudioLook] = useState<AvatarLook | null>(null);
  // A view só roda no navegador (import dinâmico sem SSR), então dá para ler o tipo de tela já no primeiro render.
  const [isTouch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const { status, errorMessage, currentRoom, quality, templateKey, panel, setStatus, setCurrentRoom, setQuality, setTemplateKey, setPanel } =
    useOrbitaStationStore();

  const openStudio = useCallback(() => {
    setStudioLook(readAvatarLook(userId));
    engineRef.current?.setMode("play");
    engineRef.current?.setPaused(true);
    setPanel("studio");
  }, [userId, setPanel]);

  const closePanel = useCallback(() => {
    // Primeira visita: quem fecha o estúdio sem salvar fica com o visual sugerido, e ele não reabre sozinho.
    if (panel === "studio" && !hasSavedAvatarLook(userId)) saveAvatarLook(userId, readAvatarLook(userId));
    engineRef.current?.setPaused(false);
    engineRef.current?.setMode("play");
    setPanel("none");
  }, [panel, userId, setPanel]);

  const toggleMap = useCallback(() => {
    const isOpening = panel !== "map";
    engineRef.current?.setMode(isOpening ? "map" : "play");
    setPanel(isOpening ? "map" : "none");
  }, [panel, setPanel]);

  useEffect(() => {
    const initialTemplate = readTemplateKey() ?? "completo";
    setTemplateKey(initialTemplate);
    setStatus("loading");
    setPanel("none");
    let engine: StationEngine;
    try {
      engine = new StationEngine(hostRef.current!, {
        templateKey: initialTemplate,
        look: readAvatarLook(userId),
        onEvent: (event) => {
          if (event.type === "ready") {
            setReadyEngine(engine);
            setStatus("ready");
            if (!hasSavedAvatarLook(userId)) {
              setStudioLook(readAvatarLook(userId));
              engine.setPaused(true);
              setPanel("studio");
            }
          }
          if (event.type === "error") setStatus("error", event.message);
          if (event.type === "roomChange") setCurrentRoom(event.room);
          if (event.type === "qualityChange") setQuality(event.tier);
        },
      });
    } catch (error) {
      setStatus(error instanceof WebGLUnavailableError ? "no-webgl" : "error", "Não foi possível abrir a estação 3D.");
      return;
    }
    engineRef.current = engine;
    void engine.start();
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [userId, setStatus, setCurrentRoom, setQuality, setTemplateKey, setPanel]);

  useEffect(() => {
    if (status !== "ready") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || panel === "studio") return;
      const key = event.key.toLowerCase();
      if (key === "m") toggleMap();
      if (key === "escape" && panel === "map") toggleMap();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status, panel, toggleMap]);

  const changeTemplate = (nextTemplateKey: string) => {
    setTemplateKey(nextTemplateKey);
    saveTemplateKey(nextTemplateKey);
    engineRef.current?.setTemplate(nextTemplateKey);
  };

  const saveLook = (look: AvatarLook) => {
    if (!saveAvatarLook(userId, look)) toast.error("Não foi possível salvar o personagem neste navegador.");
    engineRef.current?.setLook(look);
    closePanel();
  };

  const pickRoom = (roomKey: string) => {
    engineRef.current?.walkToRoom(roomKey);
    toggleMap();
  };

  const downloadCapture = async () => {
    const image = await engineRef.current?.captureImage();
    if (!image) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(image);
    link.download = `orbita-station-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black text-white">
      <div ref={hostRef} className="absolute inset-0" />

      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex items-center gap-3 rounded-full bg-black/40 px-5 py-3 text-sm backdrop-blur">
            <Spinner /> Montando a estação…
          </div>
        </div>
      )}
      {(status === "no-webgl" || status === "error") && (
        <div className="absolute inset-0 grid place-items-center p-6">
          <div className="max-w-sm rounded-2xl bg-black/50 p-6 text-center backdrop-blur">
            <p className="font-semibold">
              {status === "no-webgl" ? "Seu navegador não consegue mostrar a estação 3D" : errorMessage}
            </p>
            <p className="mt-2 text-sm text-white/70">
              {status === "no-webgl"
                ? "A estação precisa de WebGL 2. Atualize o navegador ou ative a aceleração de hardware nas configurações."
                : "Recarregue a página. Se continuar, avise o suporte."}
            </p>
          </div>
        </div>
      )}

      {status === "ready" && readyEngine && panel === "map" && <StationMapLabels engine={readyEngine} onPickRoom={pickRoom} />}

      {status === "ready" && panel !== "studio" && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-4">
            <div className="pointer-events-auto rounded-2xl bg-black/40 px-4 py-2 backdrop-blur">
              {panel === "map" ? (
                <>
                  <p className="text-xs uppercase tracking-wider text-white/70">Mapa da estação</p>
                  <p className="text-lg font-semibold leading-tight">Escolha uma sala para ir até ela</p>
                </>
              ) : (
                <>
                  <p className="text-xs uppercase tracking-wider text-white/70">{currentRoom ? (currentRoom.module === "—" ? "Sala" : currentRoom.module) : "Circulação"}</p>
                  <p className="text-lg font-semibold leading-tight">{currentRoom ? currentRoom.name : "Corredor"}</p>
                </>
              )}
            </div>
            <div className="pointer-events-auto flex w-full min-w-0 items-center gap-2 sm:w-auto">
              <Select value={templateKey} onValueChange={changeTemplate}>
                <SelectTrigger aria-label="Modelo da estação" className="min-w-0 flex-1 border-white/20 bg-black/40 text-white backdrop-blur sm:w-56 sm:flex-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATION_TEMPLATES.map((template) => (
                    <SelectItem key={template.key} value={template.key}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="icon" variant={panel === "map" ? "default" : "secondary"} aria-label="Mapa da estação (M)" aria-pressed={panel === "map"} onClick={toggleMap}>
                <MapIcon />
              </Button>
              <Button size="icon" variant="secondary" aria-label="Estúdio do personagem" onClick={openStudio}>
                <UserRound />
              </Button>
              <Button size="icon" variant="secondary" aria-label="Baixar print da cena" onClick={downloadCapture}>
                <Camera />
              </Button>
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-0 right-0 flex flex-col items-end gap-2 p-4">
            <div className="pointer-events-auto flex flex-col gap-1">
              <Button size="icon" variant="secondary" aria-label="Aproximar" onClick={() => engineRef.current?.zoomBy(1.15)}>
                <Plus />
              </Button>
              <Button size="icon" variant="secondary" aria-label="Afastar" onClick={() => engineRef.current?.zoomBy(1 / 1.15)}>
                <Minus />
              </Button>
            </div>
            <button
              type="button"
              className="pointer-events-auto rounded-full bg-black/40 px-3 py-1 text-xs text-white/80 backdrop-blur"
              onClick={() => engineRef.current?.setQuality(quality === "medio" ? "leve" : "medio")}
            >
              Gráfico: {quality === "medio" ? "médio" : "leve"}
            </button>
          </div>

          {isTouch ? (
            <div className="pointer-events-none absolute bottom-0 left-0 p-6">
              <TouchJoystick onMove={(x, y) => engineRef.current?.setMoveInput(x, y)} />
            </div>
          ) : (
            <p className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-black/40 px-3 py-1 text-xs text-white/80 backdrop-blur">
              WASD ou setas para andar · M abre o mapa · roda do mouse para aproximar
            </p>
          )}
        </>
      )}

      {status === "ready" && readyEngine && panel === "studio" && studioLook && (
        <AvatarStudio engine={readyEngine} initialLook={studioLook} onSave={saveLook} onClose={closePanel} />
      )}
    </div>
  );
}
