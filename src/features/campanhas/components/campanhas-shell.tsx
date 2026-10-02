"use client";

import { Suspense, type ComponentType } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BarChart3, CircleHelp, LayoutTemplate, Lock, Send, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { useCampanhasSectionCounts } from "../hooks/use-campanhas-section-counts";
import { useSendingNumbers } from "../hooks/use-sending-numbers";

/**
 * Shell do app de Campanhas: menu das seções no topo (desktop, com totais) + dock em
 * órbita no celular. Envolve o conteúdo de todas as telas do app
 * pra dar uma navegação única e consistente (Campanhas / Modelos / Contatos /
 * Analytics).
 */

interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
}

const NAV: NavItem[] = [
  {
    href: "/campanhas/templates",
    label: "Modelos",
    description: "Templates aprovados",
    icon: LayoutTemplate,
    match: (path) => path.startsWith("/campanhas/templates"),
  },
  {
    href: "/campanhas/contatos",
    label: "Contatos",
    description: "Base unificada",
    icon: Users,
    match: (path) => path.startsWith("/campanhas/contatos"),
  },
  {
    href: "/campanhas/analytics",
    label: "Analytics",
    description: "Métricas de envio",
    icon: BarChart3,
    match: (path) => path.startsWith("/campanhas/analytics"),
  },
];

// "Campanhas" (disparos) fica no topo e cobre a home + o detalhe /campanhas/<id>,
// desde que não seja uma das seções específicas acima.
/** A lista de campanhas só aparece depois de clicar em "Campanhas" (a home fica com o número e o convite). */
export const CAMPAIGNS_LIST_PARAM = "lista";
const CAMPAIGNS_LIST_HREF = `/campanhas?${CAMPAIGNS_LIST_PARAM}=1`;
const NO_NUMBER_MESSAGE = "Conecte seu número e crie sua primeira campanha";

const CAMPAIGNS_ITEM: NavItem = {
  href: CAMPAIGNS_LIST_HREF,
  label: "Campanhas",
  description: "Disparos em massa",
  icon: Send,
  match: (path) =>
    path === "/campanhas" ||
    (path.startsWith("/campanhas/") && !NAV.some((item) => item.match(path))),
};

/** Primeira aba: benefícios, custos e passo a passo (a home das Campanhas sem a lista). */
const HOW_IT_WORKS_ITEM: NavItem = {
  href: "/campanhas",
  label: "Como funciona?",
  description: "Benefícios e custos",
  icon: CircleHelp,
  match: (path) => path === "/campanhas",
};

const ALL_ITEMS = [HOW_IT_WORKS_ITEM, CAMPAIGNS_ITEM, ...NAV];

interface NavState {
  pathname: string;
  isListOpen: boolean;
  isCampaignsLocked: boolean;
}

function isItemActive(item: NavItem, { pathname, isListOpen }: NavState): boolean {
  if (item === CAMPAIGNS_ITEM && pathname === "/campanhas") return isListOpen;
  if (item === HOW_IT_WORKS_ITEM) return pathname === "/campanhas" && !isListOpen;
  return item.match(pathname);
}

function toDockItem(item: NavItem, navState: NavState) {
  const Icon = item.icon;
  if (item === CAMPAIGNS_ITEM && navState.isCampaignsLocked) {
    return { label: item.label, icon: <Lock />, onSelect: () => toast.info(NO_NUMBER_MESSAGE) };
  }
  return { label: item.label, href: item.href, icon: <Icon />, isActive: isItemActive(item, navState) };
}

/** Lê a URL (?lista=1) e o número conectado; fica num Suspense por causa do useSearchParams. */
function useNavState(): NavState {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: sendingNumbers, isLoading } = useSendingNumbers();
  return {
    pathname,
    isListOpen: searchParams.get(CAMPAIGNS_LIST_PARAM) === "1",
    isCampaignsLocked: !isLoading && !sendingNumbers?.length,
  };
}

export function CampanhasShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 flex-col">
      <Suspense fallback={null}>
        <CampanhasNavigation />
      </Suspense>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

function CampanhasNavigation() {
  const navState = useNavState();

  // No celular as quatro seções vão para o dock em órbita (a barra rolável saiu).
  useRegisterOrbitDock({
    leftItems: [toDockItem(CAMPAIGNS_ITEM, navState), toDockItem(NAV[0], navState)],
    // Analytics fica só no menu do computador: no celular o 4º lugar é do "Como funciona?".
    rightItems: [toDockItem(NAV[1], navState), toDockItem(HOW_IT_WORKS_ITEM, navState)],
  });

  return (
    <div className="mx-auto hidden w-full max-w-5xl px-4 pt-6 sm:px-6 md:block lg:px-8">
      <CampanhasSectionMenu navState={navState} />
    </div>
  );
}

/** Menu das seções no desktop, acima do conteúdo, com o total de cada uma. */
function CampanhasSectionMenu({ navState }: { navState: NavState }) {
  const counts = useCampanhasSectionCounts();
  return (
    <nav className="flex items-center gap-1 rounded-full border bg-card p-1 shadow-xs">
      {ALL_ITEMS.map((item) => {
        const isActive = isItemActive(item, navState);
        const Icon = item.icon;
        const count = counts[item.href];
        const itemClassName = cn(
          "flex h-10 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
          isActive ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        );
        if (item === CAMPAIGNS_ITEM && navState.isCampaignsLocked) {
          return (
            <button
              key={item.href}
              type="button"
              aria-disabled
              title={NO_NUMBER_MESSAGE}
              onClick={() => toast.info(NO_NUMBER_MESSAGE)}
              className={cn(itemClassName, "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-foreground")}
            >
              <Lock className="size-4 shrink-0" />
              {item.label}
            </button>
          );
        }
        return (
          <Link key={item.href} href={item.href} className={itemClassName}>
            <Icon className="size-4 shrink-0" />
            {item.label}
            {count !== undefined && (
              <span
                className={cn(
                  "min-w-6 rounded-full px-2 py-0.5 text-center text-[11px] font-semibold tabular-nums",
                  isActive ? "bg-background/20 text-background" : "bg-muted text-foreground",
                )}
              >
                {count.toLocaleString("pt-BR")}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Container padrão do conteúdo de cada tela do app. */
export function CampanhasContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
