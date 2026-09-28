"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarDaysIcon,
  Columns3Icon,
  ListIcon,
  Maximize2Icon,
  Minimize2Icon,
  PlusIcon,
} from "lucide-react";
import { useQueryState } from "nuqs";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CreateActionModal } from "./create-action-modal";
import { DataKanban } from "./data-kanban";
import { DataTable } from "./data-table";
import { FiltersBar } from "./filters-bar";
import { FiltersSheet } from "./filters-sheet";
import { cn } from "@/lib/utils";
import { CreateActionWithAi } from "./ai-button";
import { useTour } from "@/features/tour/context";
import { WorkspaceCalendarModal } from "@/features/workspace/components/workspace-calendar-modal";

interface Props {
  workspaceId: string;
}

export function ActionsViewSwitcher({ workspaceId }: Props) {
  const [localOpen, setLocalOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Tela cheia real (F11) via Fullscreen API no `documentElement` — pedimos o
  // fullscreen na raiz `<html>` (não no board) pra que os modais portalados no
  // `<body>` continuem dentro da subárvore em fullscreen e sigam visíveis. O
  // `fixed inset-0` faz o Kanban ocupar 100% desse espaço.
  const [isMaximized, setIsMaximized] = useState(false);
  // Flag pra suprimir o `onOpenChange` que o Radix dispara quando trocamos
  // o prop `open` programaticamente após criar a ação. Sem isso, ele reseta
  // os params da URL (setCreateParam(null) etc) e atrapalha o redirect
  // pra `?actionId=...&highlight=public`.
  const [skipNextOpenChange, setSkipNextOpenChange] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [view, setView] = useQueryState("action-view", {
    defaultValue: "list",
  });
  const [createParam, setCreateParam] = useQueryState("create");
  const [seedTitle, setSeedTitle] = useQueryState("seedTitle");
  const [seedStartDate, setSeedStartDate] = useQueryState("seedStartDate");
  const presetPublic = createParam === "event-public";
  const { endTour } = useTour();

  // Modal abre se o usuário clicou no botão OU se chegou com ?create=event-public
  const open = localOpen || presetPublic;
  const setOpen = setLocalOpen;

  // Fluxo do calendário público: o `OnboardingWizard` dispara `startTour`
  // 600ms depois de finalizar — esse tour cobre a tela e esconde a modal de
  // criação. Quando chegamos com `?create=event-public`, cancelamos o tour
  // logo após o mount e novamente em ~800ms (cobre o setTimeout do wizard).
  useEffect(() => {
    if (!presetPublic) return;
    endTour();
    const t = setTimeout(() => endTour(), 800);
    return () => clearTimeout(t);
  }, [presetPublic, endTour]);

  // Sincroniza o estado com o fullscreen do browser: sair via F11/Esc dispara
  // `fullscreenchange` e reseta o maximize (mantém o ícone e o layout corretos).
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setIsMaximized(false);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Fallback do Esc só pro modo CSS (quando a Fullscreen API foi bloqueada). No
  // fullscreen nativo, o próprio browser sai no Esc e dispara `fullscreenchange`.
  useEffect(() => {
    if (!isMaximized) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) {
        setIsMaximized(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMaximized]);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      setIsMaximized(false);
      try {
        await document.exitFullscreen();
      } catch {
        // Ignora: alguns navegadores rejeitam exit fora de gesto do usuário.
      }
      return;
    }
    setIsMaximized(true);
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen API bloqueada (permissão/iframe): o `fixed inset-0` já cobre
      // a viewport, então o maximize por CSS funciona como fallback.
    }
  };

  return (
    <>
      <Tabs
        className={cn(
          "flex-1 w-full h-full",
          isMaximized && "fixed inset-0 z-[60] bg-background",
        )}
        value={view || "list"}
        onValueChange={(next) => {
          // "calendar" não é uma view real — é um shortcut pra abrir o
          // `WorkspaceCalendarModal`. Não atualizamos `view` (o tab fica
          // como "list"/"kanban" anterior) pra não quebrar o estado.
          if (next === "calendar") {
            setCalendarOpen(true);
            return;
          }
          setView(next);
        }}
      >
        <div className="h-full flex flex-col">
          {/* Top bar: views + new button */}
          <div className="sticky top-0 z-50 bg-background flex flex-col gap-y-2 lg:flex-row justify-between items-center py-2 px-4 border-b">
            <TabsList className="w-full lg:w-auto">
              <TabsTrigger value="list" className="h-8 w-full lg:w-auto">
                <ListIcon className="size-4" />
                Lista
              </TabsTrigger>
              <TabsTrigger value="kanban" className="h-8 w-full lg:w-auto">
                <Columns3Icon className="size-4" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="calendar" className="h-8 w-full lg:w-auto">
                <CalendarDaysIcon className="size-4" />
                Calendário
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Filters bar */}
          <div className="px-4 py-2 border-b bg-background/80 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex">
                <FiltersBar workspaceId={workspaceId} />
              </div>
              <FiltersSheet workspaceId={workspaceId} />
            </div>
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-8 shrink-0"
                onClick={toggleFullscreen}
                aria-label={
                  isMaximized ? "Sair da tela cheia" : "Ver em tela cheia"
                }
                title={isMaximized ? "Sair da tela cheia (Esc)" : "Tela cheia"}
              >
                {isMaximized ? (
                  <Minimize2Icon className="size-4" />
                ) : (
                  <Maximize2Icon className="size-4" />
                )}
              </Button>
              <CreateActionWithAi workspaceId={workspaceId} />
              <Button
                size="sm"
                className="flex-1 lg:w-auto"
                onClick={() => setOpen(true)}
              >
                <PlusIcon className="size-4" />
                Nova ação
              </Button>
            </div>
          </div>

          {/* Filters bar */}
          {/* <div className="px-4 py-2 border-b bg-background/80 flex items-center gap-2 flex-wrap">
            <FiltersSheet workspaceId={workspaceId} />
            <FiltersBar workspaceId={workspaceId} />
          </div> */}

          <div className="flex-1 overflow-auto">
            <div className={cn("h-full", view !== "list" && "hidden")}>
              <DataTable workspaceId={workspaceId} />
            </div>

            <div className={cn("h-full", view !== "kanban" && "hidden")}>
              <DataKanban workspaceId={workspaceId} />
            </div>
          </div>
        </div>
      </Tabs>
      <CreateActionModal
        open={open}
        onOpenChange={(next) => {
          // Consome o skip se foi flagueado pelo onCreated (evita reverter
          // a URL recém-setada com actionId+highlight).
          if (skipNextOpenChange) {
            setSkipNextOpenChange(false);
            setLocalOpen(next);
            return;
          }
          setLocalOpen(next);
          if (!next && presetPublic) {
            setCreateParam(null);
            if (seedTitle) setSeedTitle(null);
            if (seedStartDate) setSeedStartDate(null);
          }
        }}
        workspaceId={workspaceId}
        presetPublic={presetPublic}
        presetTitle={presetPublic ? (seedTitle ?? undefined) : undefined}
        presetStartDate={
          presetPublic && seedStartDate
            ? new Date(seedStartDate)
            : undefined
        }
        onCreated={(newActionId) => {
          // Fluxo do calendário: substitui a URL inteira em uma única
          // navegação, antes do Radix Dialog disparar onOpenChange ao
          // re-renderizar com `open=false`. O destaque da Visualização
          // Pública usa sessionStorage pra evitar race de query params.
          if (presetPublic) {
            setSkipNextOpenChange(true);
            try {
              sessionStorage.setItem("nasa:highlightPublic", newActionId);
            } catch {
              // privacy mode / SSR / fallback silencioso
            }
            const params = new URLSearchParams();
            params.set("actionId", newActionId);
            router.replace(`${pathname}?${params.toString()}`);
          }
          setLocalOpen(false);
        }}
      />
      <WorkspaceCalendarModal
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
      />
    </>
  );
}

