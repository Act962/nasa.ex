"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Map as MapIcon, Minus, PencilRuler, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StationEngine, WebGLUnavailableError } from "../engine/station-engine";
import { useOrbitaStation, useSaveOrbitaAvatar, useUpdateOrbitaStation } from "../hooks/use-orbita-station";
import { defaultLook, type AvatarLook } from "../lib/avatar-look";
import { clearLegacyPreferences, readLegacyAvatarLook } from "../lib/station-preferences";
import type { RoomNames, StationSettings } from "../lib/station-settings";
import { useOrbitaStationStore } from "../store/use-orbita-station-store";
import { AvatarStudio } from "./avatar-studio";
import { StationEditor } from "./station-editor";
import { StationMapLabels } from "./station-map-labels";
import { TouchJoystick } from "./touch-joystick";

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || target.closest("input, select, textarea") !== null);

function CenteredMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid h-dvh w-full place-items-center bg-black p-6 text-white">
      <div className="max-w-sm rounded-2xl bg-white/5 p-6 text-center">
        <p className="font-semibold">{title}</p>
        <p className="mt-2 text-sm text-white/70">{detail}</p>
      </div>
    </div>
  );
}

/** Carrega a estação da empresa e o avatar do servidor antes de montar o motor (spec 0119). */
export function OrbitaStationView({ userId }: { userId: string }) {
  const stationQuery = useOrbitaStation();
  if (stationQuery.isPending) {
    return (
      <div className="grid h-dvh w-full place-items-center bg-black text-white">
        <div className="flex items-center gap-3 text-sm">
          <Spinner /> Carregando a estação da empresa…
        </div>
      </div>
    );
  }
  if (stationQuery.isError) {
    return <CenteredMessage title="Não foi possível abrir a estação" detail={stationQuery.error.message} />;
  }
  return <StationExperience userId={userId} initialStation={stationQuery.data.station} serverAvatar={stationQuery.data.avatar} canEdit={stationQuery.data.canEdit} />;
}

interface StationExperienceProps {
  userId: string;
  initialStation: StationSettings;
  serverAvatar: AvatarLook | null;
  canEdit: boolean;
}

function StationExperience({ userId, initialStation, serverAvatar, canEdit }: StationExperienceProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<StationEngine | null>(null);
  const [readyEngine, setReadyEngine] = useState<StationEngine | null>(null);
  const [station, setStation] = useState(initialStation);
  // Ordem do primeiro visual: o do servidor; senão o que a etapa 1 guardou no navegador (migrado uma vez); senão o padrão.
  const [initialLook] = useState(() => ({ legacy: readLegacyAvatarLook(userId), fromServer: serverAvatar }));
  const [look, setLook] = useState<AvatarLook>(() => initialLook.fromServer ?? initialLook.legacy ?? defaultLook(userId));
  const [hasSavedLook, setHasSavedLook] = useState(() => Boolean(initialLook.fromServer ?? initialLook.legacy));
  const [studioLook, setStudioLook] = useState<AvatarLook | null>(null);
  // A view só roda no navegador (import dinâmico sem SSR), então dá para ler o tipo de tela já no primeiro render.
  const [isTouch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const { status, errorMessage, currentRoom, quality, panel, setStatus, setCurrentRoom, setQuality, setPanel } = useOrbitaStationStore();
  const saveAvatar = useSaveOrbitaAvatar();
  const updateStation = useUpdateOrbitaStation();

  // Migração da etapa 1 (RF-5): o avatar do navegador sobe uma vez, sem sobrescrever um que já esteja no servidor.
  useEffect(() => {
    const { legacy, fromServer } = initialLook;
    if (!legacy) return;
    if (fromServer) {
      clearLegacyPreferences(userId);
      return;
    }
    saveAvatar.mutate({ look: legacy, onlyIfEmpty: true }, { onSuccess: () => clearLegacyPreferences(userId) });
    // Roda uma vez por montagem: `saveAvatar` muda de identidade a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLook, userId]);

  const persistLook = useCallback(
    (nextLook: AvatarLook) => {
      setLook(nextLook);
      setHasSavedLook(true);
      saveAvatar.mutate({ look: nextLook, onlyIfEmpty: false }, { onError: () => toast.error("Não foi possível salvar o personagem. Tente de novo.") });
    },
    [saveAvatar],
  );

  const openStudio = useCallback(() => {
    setStudioLook(look);
    engineRef.current?.setMode("play");
    engineRef.current?.setPaused(true);
    setPanel("studio");
  }, [look, setPanel]);

  const closePanel = useCallback(() => {
    // Primeira visita: quem fecha o estúdio sem salvar fica com o visual sugerido, e ele não reabre sozinho.
    if (panel === "studio" && !hasSavedLook) persistLook(look);
    engineRef.current?.setPaused(false);
    engineRef.current?.setMode("play");
    setPanel("none");
  }, [panel, hasSavedLook, look, persistLook, setPanel]);

  const toggleMap = useCallback(() => {
    const isOpening = panel !== "map";
    engineRef.current?.setMode(isOpening ? "map" : "play");
    setPanel(isOpening ? "map" : "none");
  }, [panel, setPanel]);

  useEffect(() => {
    setStatus("loading");
    setPanel("none");
    let engine: StationEngine;
    try {
      engine = new StationEngine(hostRef.current!, {
        templateKey: initialStation.templateKey,
        roomNames: initialStation.roomNames,
        look,
        onEvent: (event) => {
          if (event.type === "ready") {
            setReadyEngine(engine);
            setStatus("ready");
            if (!hasSavedLook) {
              setStudioLook(look);
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
    // O motor nasce uma vez com o estado inicial; mudanças depois vão por setStation/setLook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, setStatus, setCurrentRoom, setQuality, setPanel]);

  useEffect(() => {
    if (status !== "ready") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || panel === "studio" || panel === "editor") return;
      const key = event.key.toLowerCase();
      if (key === "m") toggleMap();
      if (key === "escape" && panel === "map") toggleMap();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status, panel, toggleMap]);

  const saveLook = (nextLook: AvatarLook) => {
    persistLook(nextLook);
    engineRef.current?.setLook(nextLook);
    engineRef.current?.setPaused(false);
    setPanel("none");
  };

  const applyStation = (next: StationSettings) => {
    setStation(next);
    engineRef.current?.setStation(next.templateKey, next.roomNames);
  };

  const saveStation = (templateKey: string, roomNames: RoomNames) => {
    updateStation.mutate(
      { templateKey, roomNames, version: station.version },
      {
        onSuccess: ({ station: saved }) => {
          applyStation(saved);
          setPanel("none");
          toast.success("Estação atualizada para toda a empresa.");
        },
        onError: (error) => {
          // Outra pessoa salvou antes (CB-2): mostra a versão nova em vez de sobrescrever o trabalho dela.
          const conflictStation = (error as { data?: { station?: StationSettings } }).data?.station;
          if (conflictStation) applyStation(conflictStation);
          toast.error(error.message);
        },
      },
    );
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
            <div className="pointer-events-auto flex items-center gap-2">
              <Button size="icon" variant={panel === "map" ? "default" : "secondary"} aria-label="Mapa da estação (M)" aria-pressed={panel === "map"} onClick={toggleMap}>
                <MapIcon />
              </Button>
              <Button size="icon" variant="secondary" aria-label="Estúdio do personagem" onClick={openStudio}>
                <UserRound />
              </Button>
              {canEdit && (
                <Button
                  size="icon"
                  variant={panel === "editor" ? "default" : "secondary"}
                  aria-label="Editar a estação"
                  aria-pressed={panel === "editor"}
                  onClick={() => setPanel(panel === "editor" ? "none" : "editor")}
                >
                  <PencilRuler />
                </Button>
              )}
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

      {status === "ready" && panel === "editor" && canEdit && (
        <StationEditor station={station} isSaving={updateStation.isPending} onSave={saveStation} onClose={() => setPanel("none")} />
      )}

      {status === "ready" && readyEngine && panel === "studio" && studioLook && (
        <AvatarStudio engine={readyEngine} initialLook={studioLook} onSave={saveLook} onClose={closePanel} />
      )}
    </div>
  );
}
