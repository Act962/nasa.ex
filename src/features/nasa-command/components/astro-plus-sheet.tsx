"use client";

import { useId, useState, type ReactNode } from "react";
import { ArrowLeftIcon, BellRingIcon, HistoryIcon, LightbulbIcon, PaperclipIcon, PlusIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ACCEPT_ATTACHMENT_TYPES } from "@/features/payment/lib/attachments";
import { cn } from "@/lib/utils";
import { ExampleList } from "./example-library";
import { HistoryList } from "./history-dropdown";
import { HomeAlertsList, useHomeAlerts } from "./home-alerts-list";
import type { RecentAstroSession } from "./recent-requests";

type PlusSheetView = "menu" | "alerts" | "examples" | "history";

interface AstroPlusSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectExample: (example: string) => void;
  onPrompt: (prompt: string) => void;
  sessions: RecentAstroSession[];
  sessionsLoading?: boolean;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onAfterRenameSession?: () => void;
  onNewSession?: () => void;
  onAddFiles?: (files: File[]) => void;
}

interface PlusTile {
  key: string;
  label: string;
  icon: ReactNode;
  iconClassName: string;
  onSelect?: () => void;
  htmlFor?: string;
  badgeCount?: number;
}

/** Aba do "+" do ASTRO na Início: Biblioteca de exemplos, Histórico, nova conversa e anexos. */
export function AstroPlusSheet({
  open,
  onOpenChange,
  onSelectExample,
  onPrompt,
  sessions,
  sessionsLoading,
  onSelectSession,
  onDeleteSession,
  onAfterRenameSession,
  onNewSession,
  onAddFiles,
}: AstroPlusSheetProps) {
  const [view, setView] = useState<PlusSheetView>("menu");
  const fileInputId = useId();
  const { alertGroups } = useHomeAlerts();

  const changeOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) setView("menu");
  };
  const close = () => changeOpen(false);

  const tiles: PlusTile[] = [
    {
      key: "alerts",
      label: "Avisos",
      icon: <BellRingIcon />,
      iconClassName: "text-destructive",
      onSelect: () => setView("alerts"),
      badgeCount: alertGroups.length,
    },
    {
      key: "examples",
      label: "Biblioteca de exemplos",
      icon: <LightbulbIcon />,
      iconClassName: "text-warning",
      onSelect: () => setView("examples"),
    },
    {
      key: "history",
      label: "Histórico",
      icon: <HistoryIcon />,
      iconClassName: "text-info",
      onSelect: () => setView("history"),
    },
    ...(onNewSession
      ? [
          {
            key: "new-session",
            label: "Nova conversa",
            icon: <PlusIcon />,
            iconClassName: "text-success",
            onSelect: () => {
              onNewSession();
              close();
            },
          },
        ]
      : []),
    ...(onAddFiles
      ? [
          {
            key: "attach",
            label: "Anexar arquivo",
            icon: <PaperclipIcon />,
            iconClassName: "text-muted-foreground",
            htmlFor: fileInputId,
          },
        ]
      : []),
  ];

  const VIEW_TITLES: Record<PlusSheetView, string> = {
    menu: "Mais opções",
    alerts: "Avisos",
    examples: "Biblioteca de exemplos",
    history: "Histórico",
  };
  const viewTitle = VIEW_TITLES[view];

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetContent side="bottom" className="max-h-[85svh] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <SheetHeader className={cn(view === "menu" && "sr-only")}>
          <SheetTitle className="flex items-center gap-2">
            {view !== "menu" && (
              <button
                type="button"
                onClick={() => setView("menu")}
                aria-label="Voltar"
                className="grid size-8 place-items-center rounded-full bg-knob"
              >
                <ArrowLeftIcon className="size-4" />
              </button>
            )}
            {viewTitle}
          </SheetTitle>
          <SheetDescription className="sr-only">Opções do ASTRO Explorer.</SheetDescription>
        </SheetHeader>

        {view === "menu" && (
          <div className="grid grid-cols-4 gap-x-2 gap-y-5 px-4 pt-6">
            {tiles.map((tile) => (
              <TileWrapper key={tile.key} tile={tile}>
                <span
                  className={cn(
                    "relative grid size-16 place-items-center rounded-full bg-background shadow-xs transition-transform active:scale-95 [&_svg]:size-7",
                    tile.iconClassName,
                  )}
                >
                  {tile.icon}
                  {Boolean(tile.badgeCount) && (
                    <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
                      {(tile.badgeCount ?? 0) > 9 ? "9+" : tile.badgeCount}
                    </span>
                  )}
                </span>
                <span className="text-center text-xs leading-tight text-foreground">{tile.label}</span>
              </TileWrapper>
            ))}
          </div>
        )}

        {view === "alerts" && (
          <div className="overflow-y-auto px-4">
            <HomeAlertsList onPrompt={onPrompt} onAfterAction={close} />
          </div>
        )}

        {view === "examples" && (
          <div className="overflow-y-auto px-4">
            <ExampleList
              onSelect={(example) => {
                onSelectExample(example);
                close();
              }}
            />
          </div>
        )}

        {view === "history" && (
          <div className="space-y-1.5 overflow-y-auto px-4">
            <HistoryList
              sessions={sessions}
              loading={sessionsLoading}
              onSelect={onSelectSession}
              onDelete={onDeleteSession}
              onAfterRename={onAfterRenameSession}
              onNewSession={onNewSession}
              onAfterAction={close}
            />
          </div>
        )}

        <input
          id={fileInputId}
          type="file"
          multiple
          accept={ACCEPT_ATTACHMENT_TYPES}
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length > 0) onAddFiles?.(files);
            event.target.value = "";
            close();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

function TileWrapper({ tile, children }: { tile: PlusTile; children: ReactNode }) {
  const className = "flex cursor-pointer flex-col items-center gap-2";
  if (tile.htmlFor) {
    return (
      <label htmlFor={tile.htmlFor} className={className}>
        {children}
      </label>
    );
  }
  return (
    <button type="button" onClick={tile.onSelect} className={className}>
      {children}
    </button>
  );
}
