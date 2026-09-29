"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, ChevronLeft, ChevronRight, LayoutGridIcon, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import { useQueryLead } from "@/features/leads/hooks/use-lead";
import { useLeadSidebarSummary } from "@/features/leads/hooks/use-lead-chat-sidebar";
import { LeadSidebarProfile } from "./lead-sidebar-profile";
import { LeadItemScreen } from "./lead-item-screen";
import { LEAD_SCREEN_PARAM, LEAD_SIDEBAR_ITEMS, type LeadSidebarItem, type LeadSidebarItemId } from "./sidebar-items";
import { LeadAuditButton } from "@/features/leads/components/lead-audit/lead-audit-button";
import { LeadSidebarOverview } from "./lead-sidebar-overview";
import { LightRunBorder } from "@/features/leads/components/lead-triggers/light-run-border";
import { TriggerIcon } from "@/features/leads/components/lead-triggers/trigger-icon";

// Lateral "Detalhes do Lead" da conversa: aberta mostra o perfil e a grade de
// itens; recolhida vira um trilho de ícones. A escolha fica no navegador.

const COLLAPSED_STORAGE_KEY = "tracking-chat:lead-sidebar-collapsed";


function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(isCollapsed: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, isCollapsed ? "1" : "0");
  } catch {
    // Sem armazenamento (aba anônima): só não lembra a escolha.
  }
}

function CountBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="absolute top-2 right-2 flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-5 text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** "Gatilho do lead" em destaque azul; luz na borda quando há gatilho ligado (spec 0038). */
function TriggerTile({ activeCount, onOpen, isRail }: { activeCount: number; onOpen: () => void; isRail?: boolean }) {
  const isActive = activeCount > 0;
  if (isRail) {
    return (
      <LightRunBorder
        tone={isActive ? "active" : "idle"}
        className="w-full rounded-xl"
        innerClassName="rounded-[calc(0.75rem-1.5px)] bg-gradient-to-br from-sky-900/70 to-slate-900"
      >
        <button type="button" onClick={onOpen} className="flex w-full flex-col items-center gap-1 py-3 text-white">
          <TriggerIcon className={cn("size-5", isActive && "text-sky-300")} isSpinning={isActive} />
          <span className="text-[9px]">Gatilho do lead</span>
        </button>
      </LightRunBorder>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative flex h-24 flex-col justify-between rounded-xl border border-sky-500/70 bg-gradient-to-br from-sky-900/50 to-sky-950/30 p-3 text-left text-foreground shadow-[0_0_0_1px_rgba(14,165,233,.15)] transition-colors hover:border-sky-400"
    >
      <TriggerIcon className={cn("size-7", isActive ? "text-sky-300" : "text-foreground")} isSpinning={isActive} />
      <span className="pr-4 text-xs leading-tight">Gatilho do lead</span>
      <ChevronRight className="absolute top-1/2 right-2 size-4 -translate-y-1/2 text-sky-400" />
    </button>
  );
}

function ItemTile({ item, count, onOpen }: { item: LeadSidebarItem; count?: number; onOpen: () => void }) {
  if (item.id === "leadTriggers") return <TriggerTile activeCount={count ?? 0} onOpen={onOpen} />;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative flex h-24 flex-col justify-between rounded-xl border border-[#232326] bg-[#19191A] p-3 text-left text-foreground transition-colors hover:border-zinc-600"
    >
      <CountBadge count={count} />
      <item.icon className="size-7 text-zinc-300" />
      <span className="pr-4 text-xs leading-tight">{item.label}</span>
      <ChevronRight className="absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground" />
    </button>
  );
}

function RailButton({ item, count, onOpen }: { item: LeadSidebarItem; count?: number; onOpen: () => void }) {
  if (item.id === "leadTriggers") return <TriggerTile activeCount={count ?? 0} onOpen={onOpen} isRail />;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onOpen}
          className="relative flex w-full flex-col items-center gap-1 rounded-xl border bg-muted/40 py-3 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <CountBadge count={count} />
          <item.icon className="size-5" />
          <span className="text-[9px]">{item.label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function LeadSidebar({ leadId, conversationId }: { leadId: string; conversationId: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openItem, setOpenItem] = useState<LeadSidebarItemId | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedScreen = searchParams.get(LEAD_SCREEN_PARAM);

  useEffect(() => {
    const requestedItem = LEAD_SIDEBAR_ITEMS.find((item) => item.id === requestedScreen);
    if (requestedItem) setOpenItem(requestedItem.id);
  }, [requestedScreen]);

  const closeItem = () => {
    setOpenItem(null);
    if (!requestedScreen) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete(LEAD_SCREEN_PARAM);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  const { data, isLoading } = useQueryLead(leadId);
  const { data: summary } = useLeadSidebarSummary(leadId);
  const lead = data?.lead;
  const avatarUrl = useConstructUrl(lead?.profile ?? "");

  useEffect(() => setIsCollapsed(readCollapsed()), []);

  const toggleCollapsed = () => {
    setIsCollapsed((previous) => {
      writeCollapsed(!previous);
      return !previous;
    });
  };

  const countOf = (itemId: LeadSidebarItemId) =>
    itemId === "starFriend" ? undefined : summary?.counts[itemId];

  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 flex-col overflow-hidden rounded-2xl border bg-background lg:flex",
        isCollapsed && "w-24",
      )}
      // Aberta, tem a mesma largura da lista de conversas (publicada pelo layout).
      style={isCollapsed ? undefined : { width: "var(--chat-list-width, 20rem)" }}
    >
      {isCollapsed ? (
        <div className="flex h-full flex-col items-center gap-3 overflow-y-auto px-3 py-3">
          <Button size="icon" variant="ghost" className="rounded-full" onClick={toggleCollapsed} title="Abrir detalhes do lead">
            <ChevronLeft className="size-5" />
          </Button>
          <Avatar className="size-12 border">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="font-bold">{lead?.name.trim().charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          {LEAD_SIDEBAR_ITEMS.map((item) => (
            <RailButton key={item.id} item={item} count={countOf(item.id)} onOpen={() => setOpenItem(item.id)} />
          ))}
        </div>
      ) : (
        <div className="flex h-full flex-col overflow-y-auto">
          <div className="flex items-center gap-2 px-3 py-3">
            <Button size="icon" variant="ghost" className="rounded-full" onClick={toggleCollapsed} title="Recolher">
              <ArrowLeftIcon className="size-5" />
            </Button>
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold whitespace-nowrap">Detalhes do Lead</h2>
            {lead && (
              <LeadAuditButton leadId={lead.id} />
            )}
          </div>
          {isLoading || !lead ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <LeadSidebarProfile lead={lead} />
              {lead.metrics && <LeadSidebarOverview metrics={lead.metrics} />}
              <section className="flex flex-col gap-3 p-4 pb-20">
                <h3 className="flex items-center gap-3 text-sm font-light tracking-wide">
                  <LayoutGridIcon className="size-5 fill-current" /> Módulos do Lead
                </h3>
                <div className="grid grid-cols-3 gap-2.5">
                  {LEAD_SIDEBAR_ITEMS.map((item) => (
                    <ItemTile key={item.id} item={item} count={countOf(item.id)} onOpen={() => setOpenItem(item.id)} />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {lead && (
        <LeadItemScreen
          itemId={openItem}
          lead={{ id: lead.id, name: lead.name, phone: lead.phone, email: lead.email, trackingId: lead.trackingId }}
          conversationId={conversationId}
          onClose={closeItem}
          onNavigate={setOpenItem}
        />
      )}
    </aside>
  );
}
