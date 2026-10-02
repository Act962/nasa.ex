"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ARC_TOP_PX,
  DOCK_HEIGHT_PX,
  ORBIT_DOCK_COLLAPSED_TRANSFORM,
} from "./orbit-dock-layout";
import { useOrbitDockStore } from "./orbit-dock-store";

/** Navegação inferior do celular: o orb do ASTRO no centro e duas seções do App de cada lado, sobre um arco. */

export interface OrbitDockItem {
  label: string;
  icon: ReactNode;
  /** Navega para outra rota; sem `href`, o item chama `onSelect` (ex.: trocar de aba). */
  href?: string;
  onSelect?: () => void;
  isActive?: boolean;
  /** Bolinha vermelha com contagem (ex.: leads esperando resposta). */
  badgeCount?: number;
}

interface OrbitDockProps {
  leftItems: [OrbitDockItem, OrbitDockItem];
  rightItems: [OrbitDockItem, OrbitDockItem];
  /** Some da tela junto com o orb do ASTRO (o `data-orbit-dock="hidden"` avisa o orb). */
  isHidden?: boolean;
  /** Ação no centro no lugar do ASTRO; o orb se esconde enquanto ela existir (`data-orbit-dock-center`). */
  centerAction?: OrbitDockItem;
  className?: string;
}

const ARC_RADIUS_PX = 250;
const ORB_SIZE_PX = 48;

interface OrbitSlot {
  angleDeg: number;
  sizePx: number;
  opacity: number;
}

const OUTER_SLOT: Omit<OrbitSlot, "angleDeg"> = { sizePx: 38, opacity: 0.6 };
const INNER_SLOT: Omit<OrbitSlot, "angleDeg"> = { sizePx: 44, opacity: 0.9 };

const SLOTS: OrbitSlot[] = [
  { angleDeg: -31, ...OUTER_SLOT },
  { angleDeg: -16.5, ...INNER_SLOT },
  { angleDeg: 16.5, ...INNER_SLOT },
  { angleDeg: 31, ...OUTER_SLOT },
];

const ORBIT_SLIDE_MS = 550;

const CENTER_ACTION_SIZE_PX = 54;

export function OrbitDock({
  leftItems,
  rightItems,
  centerAction,
  isHidden = false,
  className,
}: OrbitDockProps) {
  const pathname = usePathname();
  const orbitItems = [...leftItems, ...rightItems];
  const isCollapsed = useOrbitDockStore((state) => state.isCollapsed);
  const setIsCollapsed = useOrbitDockStore((state) => state.setIsCollapsed);

  // O orb flutuante do ASTRO lê esta marca para se encaixar no centro do arco.
  useEffect(() => {
    document.documentElement.dataset.orbitDock = isHidden ? "hidden" : "";
    return () => {
      delete document.documentElement.dataset.orbitDock;
    };
  }, [isHidden]);

  const hasCenterAction = Boolean(centerAction);
  useEffect(() => {
    if (!hasCenterAction) return;
    document.documentElement.dataset.orbitDockCenter = "custom";
    return () => {
      delete document.documentElement.dataset.orbitDockCenter;
    };
  }, [hasCenterAction]);

  if (isHidden) return null;

  return (
    <nav
      aria-label="Navegação do app"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 overflow-hidden transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] lg:hidden",
        "bg-linear-to-b from-transparent via-background/95 via-30% to-background",
        isCollapsed && "bg-none",
        className,
      )}
      style={{
        height: `calc(${DOCK_HEIGHT_PX}px + env(safe-area-inset-bottom))`,
        transform: isCollapsed ? ORBIT_DOCK_COLLAPSED_TRANSFORM : undefined,
      }}
    >
      <div
        aria-hidden
        className={cn(
          "absolute left-1/2 rounded-full border-[1.5px] border-foreground/25 transition-opacity duration-300 [mask-image:linear-gradient(90deg,transparent_20%,#000_38%,#000_62%,transparent_80%)]",
          isCollapsed && "opacity-0",
        )}
        style={{
          width: ARC_RADIUS_PX * 2,
          height: ARC_RADIUS_PX * 2,
          top: ARC_TOP_PX,
          marginLeft: -ARC_RADIUS_PX,
        }}
      />

      {orbitItems.map((item, index) => {
        const slot = SLOTS[index];
        const isActive = item.isActive ?? pathname === item.href;
        // Recolhendo, cada bola gira pelo círculo da linha até o centro, por baixo da bola principal.
        const angleDeg = isCollapsed ? 0 : slot.angleDeg;

        const armStyle = {
          left: "50%",
          top: ARC_TOP_PX + ARC_RADIUS_PX,
          transform: `rotate(${angleDeg}deg)`,
          transition: `transform ${ORBIT_SLIDE_MS}ms cubic-bezier(.22,1,.36,1)`,
        };
        const itemStyle = {
          left: 0,
          top: -ARC_RADIUS_PX - slot.sizePx / 2,
          // Gira ao contrário do braço: o ícone continua em pé durante o caminho.
          transform: `translateX(-50%) rotate(${-angleDeg}deg)`,
          transformOrigin: `50% ${slot.sizePx / 2}px`,
          opacity: isCollapsed
            ? 0
            : isActive || item.badgeCount
              ? 1
              : slot.opacity,
          transition: `transform ${ORBIT_SLIDE_MS}ms cubic-bezier(.22,1,.36,1), opacity ${ORBIT_SLIDE_MS}ms ease-in`,
        };
        const itemContent = (
          <>
            <span
              className={cn(
                "relative grid place-items-center rounded-full transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] active:scale-95 [&_svg]:size-4",
                isActive
                  ? "bg-foreground text-background"
                  : "bg-knob text-muted-foreground",
              )}
              style={{ width: slot.sizePx, height: slot.sizePx }}
            >
              {item.icon}
              {Boolean(item.badgeCount) && (
                <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white ring-2 ring-background">
                  {item.badgeCount! > 99 ? "99+" : item.badgeCount}
                </span>
              )}
            </span>
            <span
              className={cn(
                "mt-1 whitespace-nowrap text-[10.5px] font-medium",
                isActive ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {item.label}
            </span>
          </>
        );
        const itemClassName = cn(
          "absolute flex flex-col items-center",
          isCollapsed ? "pointer-events-none" : "pointer-events-auto",
        );

        if (item.href) {
          return (
            <div
              key={item.label}
              aria-hidden={isCollapsed}
              className="absolute size-0"
              style={armStyle}
            >
              <Link
                href={item.href}
                prefetch
                aria-current={isActive ? "page" : undefined}
                className={itemClassName}
                style={itemStyle}
              >
                {itemContent}
              </Link>
            </div>
          );
        }

        return (
          <div
            key={item.label}
            aria-hidden={isCollapsed}
            className="absolute size-0"
            style={armStyle}
          >
            <button
              type="button"
              onClick={item.onSelect}
              aria-pressed={isActive}
              className={itemClassName}
              style={itemStyle}
            >
              {itemContent}
            </button>
          </div>
        );
      })}

      {centerAction && (
        <button
          type="button"
          // Recolhido, o primeiro toque na meia bola só abre o menu de novo.
          onClick={
            isCollapsed ? () => setIsCollapsed(false) : centerAction.onSelect
          }
          aria-label={centerAction.label}
          className="pointer-events-auto absolute left-1/2 grid -translate-x-1/2 place-items-center rounded-full bg-foreground text-background shadow-[0_10px_24px_-6px_rgba(0,0,0,0.45)] transition-transform active:scale-95 [&_svg]:size-6"
          style={{
            width: CENTER_ACTION_SIZE_PX,
            height: CENTER_ACTION_SIZE_PX,
            top: ARC_TOP_PX - CENTER_ACTION_SIZE_PX / 2,
          }}
        >
          {centerAction.icon}
        </button>
      )}

      <span
        className="absolute left-1/2 -translate-x-1/2 text-[12.5px] font-bold tracking-wide text-foreground"
        style={{
          top:
            ARC_TOP_PX +
            (centerAction ? CENTER_ACTION_SIZE_PX : ORB_SIZE_PX) / 2 +
            6,
        }}
      >
        {centerAction ? centerAction.label : "ASTRO"}
      </span>
    </nav>
  );
}
