"use client";

import { Ellipsis, House, MessageSquare, ShoppingBasket, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortalTab } from "./portal-types";

const TAB_ITEMS: { id: PortalTab; label: string; icon: typeof House }[] = [
  { id: "offers", label: "Ofertas", icon: Tag },
  { id: "home", label: "Home", icon: House },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "more", label: "Mais", icon: Ellipsis },
];

/** Rodapé do app do cliente: Ofertas, Catálogo, Home, Chat, Mais (spec 0041, RF-6). */
export function PortalBottomNav({
  activeTab,
  onTabChange,
  catalogUrl,
  unreadHint,
}: {
  activeTab: PortalTab;
  onTabChange: (tab: PortalTab) => void;
  catalogUrl: string | null;
  unreadHint?: boolean;
}) {
  const [offersItem, ...restItems] = TAB_ITEMS;
  const renderTab = (item: (typeof TAB_ITEMS)[number]) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onTabChange(item.id)}
        className={cn(
          "relative flex flex-col items-center gap-1 text-[11px]",
          isActive ? "font-bold text-primary" : "text-muted-foreground",
        )}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon className={cn("size-5", isActive && item.id === "home" && "fill-current")} />
        {item.label}
        {item.id === "chat" && unreadHint && <span className="absolute top-0 right-[30%] size-2 rounded-full bg-destructive" />}
      </button>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 bg-background/95 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-5 px-2 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]">
        {renderTab(offersItem)}
        {catalogUrl ? (
          <a
            href={catalogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground"
          >
            <ShoppingBasket className="size-5" />
            Catálogo
          </a>
        ) : (
          <span className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground/50" aria-disabled>
            <ShoppingBasket className="size-5" />
            Catálogo
          </span>
        )}
        {restItems.map(renderTab)}
      </div>
    </nav>
  );
}
