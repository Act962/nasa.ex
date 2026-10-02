"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCatalogOrderPortal, useCatalogOrderStarFriends } from "../../hooks/use-catalog-order-portal";
import { OrderChat } from "./order-chat";
import { OrderNoticeToaster } from "./order-notice-toaster";
import { PortalBottomNav } from "./portal-bottom-nav";
import { PortalHome } from "./portal-home";
import { PortalJourney } from "./portal-journey";
import { PortalMore } from "./portal-more";
import {
  CustomerDataScreen,
  CustomerOrdersScreen,
  HelpScreen,
  HowItWorksScreen,
  RedemptionsScreen,
  RulesScreen,
  StarHistoryScreen,
} from "./portal-more-screens";
import { PortalOffers } from "./portal-offers";
import type { PortalMoreScreen, PortalStarFriends, PortalTab } from "./portal-types";

const TAB_TITLES: Record<PortalTab, string> = {
  offers: "Ofertas",
  home: "",
  chat: "Fale com a loja",
  more: "Mais",
};

const SCREEN_TITLES: Record<PortalMoreScreen, string> = {
  journey: "Minha jornada",
  how: "Como funciona",
  history: "Histórico de estrelas",
  redemptions: "Minhas trocas",
  orders: "Meus pedidos",
  data: "Meus dados",
  rules: "Regulamento",
  help: "Ajuda",
};

/** Área do cliente do pedido do catálogo: app com rodapé (spec 0041, RF-6). */
export function OrderPortal({ token }: { token: string }) {
  const orderQuery = useCatalogOrderPortal(token);
  const starFriendsQuery = useCatalogOrderStarFriends(token);
  const [activeTab, setActiveTab] = useState<PortalTab>("home");
  const [openScreen, setOpenScreen] = useState<PortalMoreScreen | null>(null);
  const order = orderQuery.data;
  const starFriends: PortalStarFriends | null = starFriendsQuery.data?.isActive ? starFriendsQuery.data : null;

  if (orderQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <OrbitaSpinner className="size-6 text-muted-foreground" />
      </div>
    );
  }
  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">
        Pedido não encontrado. Confira o link recebido.
      </div>
    );
  }

  const changeTab = (tab: PortalTab) => {
    setOpenScreen(null);
    setActiveTab(tab);
  };
  const openMoreScreen = (screen: PortalMoreScreen) => {
    setActiveTab("more");
    setOpenScreen(screen);
  };

  const renderScreen = () => {
    if (openScreen) {
      if (openScreen === "orders") return <CustomerOrdersScreen token={token} />;
      if (openScreen === "data") return <CustomerDataScreen order={order} />;
      if (openScreen === "help") return <HelpScreen order={order} onOpenChat={() => changeTab("chat")} />;
      if (!starFriends) return null;
      if (openScreen === "journey") return <PortalJourney starFriends={starFriends} />;
      if (openScreen === "how") return <HowItWorksScreen starFriends={starFriends} />;
      if (openScreen === "history") return <StarHistoryScreen starFriends={starFriends} />;
      if (openScreen === "redemptions") return <RedemptionsScreen starFriends={starFriends} />;
      return <RulesScreen starFriends={starFriends} />;
    }
    if (activeTab === "offers") return <PortalOffers token={token} starFriends={starFriends} catalogUrl={order.catalogUrl} />;
    if (activeTab === "chat") {
      return (
        <div className="-mx-4 overflow-hidden border-y bg-card">
          <OrderChat token={token} storeName={order.store.name} className="h-[calc(100dvh-190px)]" />
        </div>
      );
    }
    if (activeTab === "more") return <PortalMore starFriends={starFriends} onOpen={openMoreScreen} />;
    return (
      <PortalHome
        token={token}
        order={order}
        starFriends={starFriends}
        onOpenJourney={() => openMoreScreen("journey")}
        onOpenOffers={() => changeTab("offers")}
        onOpenChat={() => changeTab("chat")}
      />
    );
  };

  const title = openScreen ? SCREEN_TITLES[openScreen] : TAB_TITLES[activeTab];

  return (
    <div className="min-h-dvh bg-muted/30">
      <OrderNoticeToaster token={token} />
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-background px-4 pt-4 pb-28">
        <header className="flex items-center gap-3">
          {openScreen ? (
            <button type="button" onClick={() => setOpenScreen(null)} className="-ml-1 flex items-center gap-1 text-lg font-semibold">
              <ChevronLeft className="size-5" /> {title}
            </button>
          ) : title ? (
            <h1 className="text-lg font-semibold">{title}</h1>
          ) : (
            <>
              <Avatar className="size-10">
                {order.store.logo && <AvatarImage src={order.store.logo} alt={order.store.name} />}
                <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                  {order.store.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{order.store.name}</p>
                <p className="truncate text-xs text-muted-foreground">Olá, {order.customer.name.split(" ")[0]} 👋</p>
              </div>
              {starFriends && (
                <button type="button" onClick={() => openMoreScreen("history")} className="text-xs font-semibold text-primary">
                  Histórico
                </button>
              )}
            </>
          )}
        </header>
        {renderScreen()}
      </main>
      <PortalBottomNav activeTab={activeTab} onTabChange={changeTab} catalogUrl={order.catalogUrl} />
    </div>
  );
}
