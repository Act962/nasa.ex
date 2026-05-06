"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { type Dayjs } from "dayjs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { FiltersSidebar } from "./filters-sidebar";
import { MonthGrid } from "./month-grid";
import { MobileList } from "./mobile-list";
import { EventDetailPanel } from "./event-detail-panel";
import { EventListPanel } from "./event-list-panel";
import { usePublicEvents } from "../hooks/use-public-events";
import type { PublicEvent } from "../types";

export function CalendarShell({
  initialData,
}: {
  initialData?: Record<string, unknown>;
}) {
  const { data, isLoading } = usePublicEvents(initialData);
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [selected, setSelected] = useState<PublicEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const events = (data?.events ?? []) as unknown as PublicEvent[];

  function handleSelect(ev: PublicEvent) {
    setSelected(ev);
    setDetailOpen(true);
  }

  // Clicar numa data vazia da grade → cria um novo evento já com a data
  // de início pré-selecionada. Mantém o mesmo fluxo do botão "Criar Evento":
  // se anônimo, manda pro sign-up; se logado, cai no /calendario/criar-evento
  // que provisiona org+workspace e depois abre a modal com seedTitle/startDate.
  function handleCreateForDate(date: Dayjs) {
    const startDate = date.toISOString();
    const url = `/calendario/criar-evento?startDate=${encodeURIComponent(startDate)}`;
    if (session?.user) {
      router.push(url);
    } else {
      router.push(`/sign-up?callbackUrl=${encodeURIComponent(url)}`);
    }
  }

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col lg:flex-row">
      {/* Desktop filters sidebar */}
      <div
        className={cn(
          "hidden lg:flex lg:flex-col border-r border-border/60 overflow-hidden transition-all duration-200 shrink-0",
          sidebarOpen ? "lg:w-[260px]" : "lg:w-0 lg:border-r-0",
        )}
      >
        <div className="w-[260px]">
          <FiltersSidebar defaultOpen />
        </div>
      </div>

      {/* Mobile filters trigger */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 lg:hidden">
        <div>
          <h2 className="font-semibold">Eventos públicos</h2>
          <p className="text-xs text-muted-foreground">
            {events.length} evento{events.length === 1 ? "" : "s"}
          </p>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="mr-1.5 h-4 w-4" />
              Filtros
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[90dvh]">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <FiltersSidebar defaultOpen />
          </SheetContent>
        </Sheet>
      </div>

      {/* Calendar */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Desktop toolbar */}
        <div className="hidden items-center gap-2 border-b border-border/60 px-3 py-2 lg:flex">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Ocultar filtros" : "Mostrar filtros"}
            className="shrink-0"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </Button>
          <span className="text-xs text-muted-foreground">
            {events.length} evento{events.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Carregando eventos…
            </div>
          ) : (
            <>
              <div className="hidden h-full lg:block">
                <MonthGrid
                  events={events}
                  onSelect={handleSelect}
                  selectedId={selected?.id ?? null}
                  onCreateForDate={handleCreateForDate}
                />
              </div>
              <div className="h-full overflow-auto lg:hidden">
                <MobileList events={events} onSelect={handleSelect} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Desktop right panel — always visible event list */}
      <div className="hidden w-[300px] shrink-0 border-l border-border/60 lg:block">
        <EventListPanel
          events={events}
          selectedId={selected?.id ?? null}
          onSelect={handleSelect}
        />
      </div>

      {/* Detail Sheet — desktop + mobile */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-md overflow-auto p-0 sm:max-w-lg"
        >
          <SheetHeader className="p-4 pb-0">
            <SheetTitle>Detalhes do evento</SheetTitle>
          </SheetHeader>
          {selected && <EventDetailPanel event={selected} showFullCTA />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
