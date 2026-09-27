"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import { useQueryLead } from "@/features/leads/hooks/use-lead";
import { useLeadSidebarSummary } from "@/features/leads/hooks/use-lead-chat-sidebar";
import { LeadSidebarProfile } from "./lead-sidebar-profile";
import { LeadItemScreen } from "./lead-item-screen";
import { LEAD_SIDEBAR_ITEMS, type LeadSidebarItem, type LeadSidebarItemId } from "./sidebar-items";
import { LeadAuditButton } from "@/features/leads/components/lead-audit/lead-audit-button";
import { LeadAuditDetails } from "@/features/leads/components/lead-audit/lead-audit-details";

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
    <span className="absolute -top-1.5 -right-1.5 flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-5 text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function ItemTile({ item, count, onOpen }: { item: LeadSidebarItem; count?: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <CountBadge count={count} />
      <item.icon className="size-6" />
      <span className="text-[11px]">{item.label}</span>
    </button>
  );
}

function RailButton({ item, count, onOpen }: { item: LeadSidebarItem; count?: number; onOpen: () => void }) {
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
          <div className="flex items-center gap-1 px-2 py-3">
            <Button size="icon" variant="ghost" className="rounded-full" onClick={toggleCollapsed} title="Recolher">
              <ChevronRight className="size-5" />
            </Button>
            <h2 className="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-semibold">Detalhes do Lead</h2>
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
              {lead.metrics && (
                <div className="px-4">
                  <LeadAuditDetails metrics={lead.metrics} />
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 p-4">
                {LEAD_SIDEBAR_ITEMS.map((item) => (
                  <ItemTile key={item.id} item={item} count={countOf(item.id)} onOpen={() => setOpenItem(item.id)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {lead && (
        <LeadItemScreen
          itemId={openItem}
          lead={{ id: lead.id, name: lead.name, phone: lead.phone, email: lead.email, trackingId: lead.trackingId }}
          conversationId={conversationId}
          onClose={() => setOpenItem(null)}
        />
      )}
    </aside>
  );
}
