"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Armchair, Bell, Camera, Map as MapIcon, Minus, PencilRuler, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { DecorPlacementState } from "../engine/decor-layer";
import { StationEngine, WebGLUnavailableError, type ColleagueInfo, type StationInteraction } from "../engine/station-engine";
import {
  useFetchOrbitaJoinToken,
  useMoveOrbitaItem,
  useOrbitaRoomIndicators,
  useOrbitaStation,
  useOrbitaStationItems,
  usePickUpOrbitaItem,
  usePlaceOrbitaItem,
  useRefreshOrbitaItems,
  useSaveOrbitaAvatar,
  useUpdateOrbitaStation,
  type StationDecorItem,
} from "../hooks/use-orbita-station";
import { defaultLook, type AvatarLook } from "../lib/avatar-look";
import { EMOTES, type EmoteKey } from "../lib/emotes";
import { clearLegacyPreferences, readLegacyAvatarLook } from "../lib/station-preferences";
import type { RoomNames, StationSettings } from "../lib/station-settings";
import { StationPresence, type PresenceStatus } from "../realtime/station-presence";
import { useOrbitaStationStore } from "../store/use-orbita-station-store";
import { AvatarStudio } from "./avatar-studio";
import { ColleagueNameLabels } from "./colleague-name-labels";
import { InteractionPrompt } from "./interaction-prompt";
import { AttentionPanel } from "./attention-panel";
import { DecorPanel, PlacementBar } from "./decor-panel";
import { EmoteMenu } from "./emote-menu";
import { QueueLabels } from "./queue-labels";
import { attentionItems, type AttentionItem } from "./room-indicators";
import { StationSidePanel, type SidePanelTarget } from "./station-side-panel";
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
  return (
    <StationExperience
      userId={userId}
      initialStation={stationQuery.data.station}
      serverAvatar={stationQuery.data.avatar}
      canEdit={stationQuery.data.canEdit}
      appAccess={stationQuery.data.appAccess}
    />
  );
}

interface StationExperienceProps {
  userId: string;
  initialStation: StationSettings;
  serverAvatar: AvatarLook | null;
  canEdit: boolean;
  appAccess: Readonly<Record<string, boolean>>;
}

function StationExperience({ userId, initialStation, serverAvatar, canEdit, appAccess }: StationExperienceProps) {
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
  const itemsQuery = useOrbitaStationItems();
  const decorItems = itemsQuery.data?.items;
  const placeItem = usePlaceOrbitaItem();
  const moveItem = useMoveOrbitaItem();
  const pickUpItem = usePickUpOrbitaItem();
  const refreshItems = useRefreshOrbitaItems();
  const [placement, setPlacement] = useState<DecorPlacementState | null>(null);
  const [selectedDecorId, setSelectedDecorId] = useState<string | null>(null);
  const [hiddenDecorIds, setHiddenDecorIds] = useState<ReadonlySet<string>>(new Set());
  // Um pedido por item escolhido: clicar "Soltar aqui" de novo depois de uma falha de rede não duplica (RF-4).
  const placementRequestKeyRef = useRef<string>("");
  const confirmPlacementRef = useRef<(state: DecorPlacementState) => void>(() => {});
  const refreshItemsRef = useRef(refreshItems);
  const fetchJoinToken = useFetchOrbitaJoinToken();
  const presenceRef = useRef<StationPresence | null>(null);
  const [presence, setPresence] = useState<{ status: PresenceStatus; colleagueCount: number }>({ status: "connecting", colleagueCount: 0 });
  const [interaction, setInteraction] = useState<StationInteraction | null>(null);
  const [sideTarget, setSideTarget] = useState<SidePanelTarget | null>(null);
  const [isAttentionOpen, setIsAttentionOpen] = useState(false);
  const indicatorsQuery = useOrbitaRoomIndicators();
  const indicators = indicatorsQuery.data;
  // Itens pendentes calculados na hora da última leitura: a lista muda a cada 30 s, junto com os dados (spec 0121, D-2).
  const attention = attentionItems(indicators, indicatorsQuery.dataUpdatedAt);
  // A presença vive fora do React e lê o estado mais recente por estas referências.
  const lookRef = useRef(look);
  const stationRef = useRef(station);
  const fetchJoinTokenRef = useRef(fetchJoinToken);
  useEffect(() => {
    lookRef.current = look;
    stationRef.current = station;
    fetchJoinTokenRef.current = fetchJoinToken;
    refreshItemsRef.current = refreshItems;
  });

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
        appAccess,
        onEvent: (event) => {
          if (event.type === "ready") {
            setReadyEngine(engine);
            setStatus("ready");
            const stationPresence = new StationPresence({
              engine,
              fetchTicket: () => fetchJoinTokenRef.current(),
              getLook: () => lookRef.current,
              onStatus: (presenceStatus, colleagueCount) => setPresence({ status: presenceStatus, colleagueCount }),
              // Outro membro salvou a estação: aplica se for mais nova que a que está na tela (RF-3).
              onStationChanged: (next) => {
                if (next.version <= stationRef.current.version) return;
                stationRef.current = next;
                setStation(next);
                engine.setStation(next.templateKey, next.roomNames);
              },
              onItemsChanged: () => void refreshItemsRef.current(),
            });
            presenceRef.current = stationPresence;
            void stationPresence.start();
            if (!hasSavedLook) {
              setStudioLook(look);
              engine.setPaused(true);
              setPanel("studio");
            }
          }
          if (event.type === "error") setStatus("error", event.message);
          if (event.type === "roomChange") setCurrentRoom(event.room);
          if (event.type === "interactionChange") setInteraction(event.interaction);
          if (event.type === "lockedDoor") toast.error(`Porta trancada: você não tem acesso a ${event.room.name}`);
          if (event.type === "qualityChange") setQuality(event.tier);
          if (event.type === "decorPlacement") setPlacement(event.state);
          if (event.type === "decorConfirm") confirmPlacementRef.current(event.state);
          if (event.type === "decorPick") setSelectedDecorId(event.id);
          if (event.type === "decorHidden") setHiddenDecorIds(new Set(event.ids));
        },
      });
    } catch (error) {
      setStatus(error instanceof WebGLUnavailableError ? "no-webgl" : "error", "Não foi possível abrir a estação 3D.");
      return;
    }
    engineRef.current = engine;
    void engine.start();
    return () => {
      presenceRef.current?.stop();
      presenceRef.current = null;
      engine.dispose();
      engineRef.current = null;
    };
    // O motor nasce uma vez com o estado inicial; mudanças depois vão por setStation/setLook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, setStatus, setCurrentRoom, setQuality, setPanel]);

  // Fila de leads do NasaChat em 3D (spec 0121, RF-10): o motor recebe a lista a cada leitura nova.
  useEffect(() => {
    if (!readyEngine) return;
    const chat = indicators?.chat;
    readyEngine.setWaitingLeads(chat?.leads ?? [], chat ? Math.max(0, chat.waitingCount - chat.leads.length) : 0);
  }, [readyEngine, indicators]);

  // Decoração (spec 0118): o motor desenha o que o servidor tem; a cada lista nova, confere o que ficou fora da estação.
  useEffect(() => {
    if (!readyEngine || !decorItems) return;
    readyEngine.setDecorItems(decorItems);
  }, [readyEngine, decorItems]);

  // Qualquer outro painel (mapa, estúdio, editor) encerra o modo Decorar no motor.
  useEffect(() => {
    engineRef.current?.setDecorMode(panel === "decor", isTouch);
  }, [panel, isTouch]);

  const toggleDecor = () => {
    const isOpening = panel !== "decor";
    if (panel === "map") toggleMap();
    setSideTarget(null);
    setIsAttentionOpen(false);
    setSelectedDecorId(null);
    setPanel(isOpening ? "decor" : "none");
  };

  const chooseDecor = (itemKey: string, movingId: string | null = null) => {
    placementRequestKeyRef.current = crypto.randomUUID();
    setSelectedDecorId(null);
    void engineRef.current?.startDecorPlacement(itemKey, movingId);
  };

  const afterItemsChanged = () => {
    presenceRef.current?.publishItemsChanged();
  };

  const showItemError = (error: Error) => {
    toast.error(error.message);
    void refreshItems();
  };

  const confirmPlacement = (state: DecorPlacementState) => {
    const onSuccess = () => {
      engineRef.current?.cancelDecorPlacement();
      afterItemsChanged();
    };
    if (state.movingId) {
      const current = decorItems?.find((item) => item.id === state.movingId);
      if (!current) return;
      moveItem.mutate({ id: current.id, version: current.version, x: state.x, z: state.z, quarterTurns: state.quarterTurns }, { onSuccess, onError: showItemError });
      return;
    }
    placeItem.mutate(
      { requestKey: placementRequestKeyRef.current, itemKey: state.itemKey, x: state.x, z: state.z, quarterTurns: state.quarterTurns },
      { onSuccess, onError: showItemError },
    );
  };
  useEffect(() => {
    confirmPlacementRef.current = confirmPlacement;
  });

  const rotateItem = (item: StationDecorItem) => {
    moveItem.mutate(
      { id: item.id, version: item.version, x: item.x, z: item.z, quarterTurns: (item.quarterTurns + 1) % 4 },
      { onSuccess: afterItemsChanged, onError: showItemError },
    );
  };

  const removeItem = (item: StationDecorItem) => {
    pickUpItem.mutate(
      { id: item.id, version: item.version },
      {
        onSuccess: () => {
          setSelectedDecorId(null);
          afterItemsChanged();
        },
        onError: showItemError,
      },
    );
  };

  const isDecorBusy = placeItem.isPending || moveItem.isPending || pickUpItem.isPending;
  const decorThumbnailOf = useCallback((itemKey: string) => engineRef.current?.decorThumbnail(itemKey) ?? Promise.resolve(null), []);

  const openSidePanel = (target: SidePanelTarget | null) => {
    setIsAttentionOpen(false);
    setSideTarget(target);
  };

  const pickLead = (leadId: string) => {
    const lead = indicators?.chat?.leads.find((candidate) => candidate.id === leadId);
    openSidePanel({ type: "lead", id: leadId, name: lead?.name ?? "Cliente" });
  };

  const pickAttention = (item: AttentionItem) => {
    const room = engineRef.current?.firstRoomOfKind(item.roomKind);
    setIsAttentionOpen(false);
    if (!room) return;
    engineRef.current?.walkToRoom(room.key);
    setSideTarget({ type: "room", room });
  };

  // Emote: anima aqui e avisa os colegas. O limite de um a cada 2 s vale para os dois (spec 0120, RNF-4).
  const playEmote = (key: EmoteKey) => {
    if (presenceRef.current?.publishEmote(key) ?? true) engineRef.current?.playEmote(key);
  };
  const playEmoteRef = useRef(playEmote);
  useEffect(() => {
    playEmoteRef.current = playEmote;
  });

  // Botão de proximidade (spec 0120, RF-5): "Falar com" acena dos dois lados e abre o colega; o resto abre a sala.
  const runInteraction = useCallback(() => {
    if (!interaction) return;
    if (interaction.kind === "colleague") {
      if (presenceRef.current?.publishEmote("wave") ?? true) engineRef.current?.wave(interaction.id);
      setSideTarget({ type: "colleague", id: interaction.id, name: interaction.name });
      return;
    }
    if (interaction.kind === "lead") {
      setSideTarget({ type: "lead", id: interaction.id, name: interaction.name });
      return;
    }
    setSideTarget({ type: "room", room: interaction.room });
  }, [interaction]);

  useEffect(() => {
    if (status !== "ready") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || panel === "studio" || panel === "editor") return;
      const key = event.key.toLowerCase();
      if (panel === "decor") {
        if (key === "r" && placement) engineRef.current?.rotateDecorPlacement();
        if (key === "escape") {
          if (placement) engineRef.current?.cancelDecorPlacement();
          else if (selectedDecorId) setSelectedDecorId(null);
          else toggleDecor();
        }
        return;
      }
      if (key === "m") {
        setSideTarget(null);
        toggleMap();
      }
      if (key === "escape" && panel === "map") toggleMap();
      if (key === "escape" && panel === "none") {
        setSideTarget(null);
        setIsAttentionOpen(false);
      }
      if (key === "e" && panel === "none" && !event.repeat) runInteraction();
      const emote = EMOTES[Number(key) - 1];
      if (emote && panel === "none" && !event.repeat) playEmoteRef.current(emote.key);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // `toggleDecor` muda a cada render; o efeito já roda de novo pelas outras dependências.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, panel, toggleMap, runInteraction, placement, selectedDecorId]);

  const saveLook = (nextLook: AvatarLook) => {
    persistLook(nextLook);
    presenceRef.current?.publishLook(nextLook);
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
          presenceRef.current?.publishStation(saved);
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

  // Colega escolhido na lista do mapa: fecha o mapa e abre o painel dele (o painel só aparece fora do mapa).
  const pickColleague = (colleague: ColleagueInfo) => {
    toggleMap();
    openSidePanel({ type: "colleague", id: colleague.id, name: colleague.name });
  };

  const walkToRoom = (roomKey: string) => {
    engineRef.current?.walkToRoom(roomKey);
    setSideTarget(null);
  };

  const walkToColleague = (id: string) => {
    engineRef.current?.walkToColleague(id);
    setSideTarget(null);
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

      {status === "ready" && readyEngine && panel === "map" && <StationMapLabels engine={readyEngine} onPickRoom={pickRoom} onPickColleague={pickColleague} />}
      {status === "ready" && readyEngine && panel !== "map" && panel !== "studio" && <ColleagueNameLabels engine={readyEngine} />}
      {status === "ready" && readyEngine && indicators?.chat && (panel === "map" || (panel === "none" && currentRoom?.kind === "chat")) && (
        <QueueLabels engine={readyEngine} leads={indicators.chat.leads} onPickLead={pickLead} />
      )}

      {presence.status === "replaced" && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 p-6 backdrop-blur-sm">
          <div className="max-w-sm space-y-4 rounded-2xl bg-black/60 p-6 text-center">
            <p className="font-semibold">A estação foi aberta em outra aba</p>
            <p className="text-sm text-white/70">Você só aparece para os colegas numa aba por vez.</p>
            <Button onClick={() => window.location.reload()}>Usar esta aba</Button>
          </div>
        </div>
      )}

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
              <Button
                size="icon"
                variant={isAttentionOpen ? "default" : "secondary"}
                className="relative"
                aria-label={`O que pede atenção (${attention.length})`}
                aria-pressed={isAttentionOpen}
                onClick={() => {
                  if (panel === "map") toggleMap();
                  setSideTarget(null);
                  setIsAttentionOpen(!isAttentionOpen);
                }}
              >
                <Bell />
                {attention.length > 0 && (
                  <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-bold text-white">
                    {attention.length}
                  </span>
                )}
              </Button>
              <Button size="icon" variant={panel === "map" ? "default" : "secondary"} aria-label="Mapa da estação (M)" aria-pressed={panel === "map"} onClick={toggleMap}>
                <MapIcon />
              </Button>
              {panel === "none" && <EmoteMenu showKeys={!isTouch} onEmote={playEmote} />}
              {canEdit && (
                <Button size="icon" variant={panel === "decor" ? "default" : "secondary"} aria-label="Decorar a estação" aria-pressed={panel === "decor"} onClick={toggleDecor}>
                  <Armchair />
                </Button>
              )}
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
            <span className="rounded-full bg-black/40 px-3 py-1 text-xs text-white/80 backdrop-blur" aria-live="polite">
              {presence.status === "connected"
                ? presence.colleagueCount === 0
                  ? "Só você na estação"
                  : `${presence.colleagueCount} ${presence.colleagueCount === 1 ? "colega" : "colegas"} na estação`
                : presence.status === "connecting"
                  ? "Conectando aos colegas…"
                  : "Colegas indisponíveis agora"}
            </span>
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
              WASD ou setas para andar · E interage · M abre o mapa · roda do mouse para aproximar
            </p>
          )}

          {panel === "none" && interaction && !sideTarget && (
            <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center px-4 sm:bottom-16">
              <InteractionPrompt interaction={interaction} showKey={!isTouch} onRun={runInteraction} />
            </div>
          )}
        </>
      )}

      {status === "ready" && readyEngine && panel === "none" && sideTarget && (
        <StationSidePanel
          engine={readyEngine}
          target={sideTarget}
          currentRoom={currentRoom}
          appAccess={appAccess}
          indicators={indicators}
          onWalkToRoom={walkToRoom}
          onWalkToColleague={walkToColleague}
          onPickLead={pickLead}
          onClose={() => setSideTarget(null)}
        />
      )}

      {status === "ready" && panel === "none" && isAttentionOpen && (
        <AttentionPanel
          items={attention}
          updatedAt={indicators?.generatedAt ?? null}
          isStale={indicatorsQuery.isError}
          onPick={pickAttention}
          onClose={() => setIsAttentionOpen(false)}
        />
      )}

      {status === "ready" && panel === "decor" && canEdit && (
        <DecorPanel
          items={decorItems ?? []}
          hiddenIds={hiddenDecorIds}
          selectedId={selectedDecorId}
          isBusy={isDecorBusy}
          onChoose={(itemKey) => chooseDecor(itemKey)}
          onMove={(item) => chooseDecor(item.itemKey, item.id)}
          onRotate={rotateItem}
          onPickUp={removeItem}
          onDeselect={() => setSelectedDecorId(null)}
          onClose={toggleDecor}
          thumbnailOf={decorThumbnailOf}
        />
      )}
      {status === "ready" && panel === "decor" && placement && (
        <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center px-4 sm:bottom-16 sm:right-80">
          <PlacementBar
            state={placement}
            isBusy={isDecorBusy}
            onRotate={() => engineRef.current?.rotateDecorPlacement()}
            onConfirm={() => engineRef.current?.confirmDecorPlacement()}
            onCancel={() => engineRef.current?.cancelDecorPlacement()}
          />
        </div>
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
