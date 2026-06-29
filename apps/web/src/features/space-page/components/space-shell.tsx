"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { resolveLayout, type SpaceCardType } from "../utils/template-default";
import { SpaceHeader } from "./space-header";
import { CardProjects } from "./cards/card-projects";
import { CardCalendar } from "./cards/card-calendar";
import { CardSpaceStation } from "./cards/card-space-station";
import { CardRanking } from "./cards/card-ranking";
import { CardFollowers } from "./cards/card-followers";
import { CardReviews } from "./cards/card-reviews";
import { CardNBox } from "./cards/card-nbox";
import { CardForms } from "./cards/card-forms";
import { CardLinnker } from "./cards/card-linnker";
import { CardIntegrations } from "./cards/card-integrations";
import { CardStars } from "./cards/card-stars";
import { CardOrganogram } from "./cards/card-organogram";
import { SpaceCard } from "./space-card";
import { AddCardButton } from "./add-card-button";
import { NasaFooterPublic } from "@/components/nasa-footer-public";

/**
 * Shell client-side da Spacehome.
 *
 * Layout:
 *  - Header (fixo, sempre topo)
 *  - Space Station (fixo, logo abaixo do header)
 *  - Cards reordenáveis via drag & drop (admin) — persiste em
 *    localStorage `spacehome-layout-{orgId}` enquanto não temos schema
 *    pra layout customizado.
 *  - Card "Adicionar" (admin) no final da lista reordenável.
 *  - Footer (renderizado fora da grid)
 */
interface SpaceShellProps {
  nick: string;
  initialSpace: {
    org: {
      id: string;
      name: string;
      slug: string | null;
      logo: string | null;
      bio: string | null;
      bannerUrl: string | null;
      website: string | null;
      isSpacehomePublic: boolean;
      spacehomeTemplate: string | null;
      nasaPageId: string | null;
    };
    station: {
      id: string;
      nick: string;
      starsReceived: number | null;
    } | null;
    counts: {
      followers: number;
      publishedPosts: number;
      approvedReviews: number;
      publicActions: number;
    };
    viewer: {
      userId: string | null;
      isMember: boolean;
      isAdmin: boolean;
    };
  };
}

// Cards que NÃO podem ser arrastados/removidos
const FIXED_CARDS: SpaceCardType[] = ["header", "space-station", "footer"];

function isFixed(card: SpaceCardType): boolean {
  return FIXED_CARDS.includes(card);
}

export function SpaceShell({ nick, initialSpace }: SpaceShellProps) {
  const layout = resolveLayout(initialSpace.org.spacehomeTemplate);
  const { org, station, counts, viewer } = initialSpace;

  // Cards reordenáveis = layout completo flatten - fixos - footer
  const defaultOrder = useMemo(
    () =>
      layout.rows
        .flatMap((r) => r.cards)
        .filter((c) => !isFixed(c)),
    [layout],
  );

  const [order, setOrder] = useState<SpaceCardType[]>(defaultOrder);

  // Hidrata do localStorage por org (admin pode reorganizar a UI dele)
  useEffect(() => {
    if (!viewer.isAdmin || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(`spacehome-layout-${org.id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SpaceCardType[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      // Mantém apenas cards conhecidos + acrescenta novos defaults ao fim
      const known = new Set(defaultOrder);
      const filtered = parsed.filter((c) => known.has(c));
      const missing = defaultOrder.filter((c) => !filtered.includes(c));
      setOrder([...filtered, ...missing]);
    } catch {
      /* ignore */
    }
  }, [org.id, viewer.isAdmin, defaultOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIdx = prev.indexOf(active.id as SpaceCardType);
      const newIdx = prev.indexOf(over.id  as SpaceCardType);
      if (oldIdx < 0 || newIdx < 0) return prev;
      const next = arrayMove(prev, oldIdx, newIdx);
      if (viewer.isAdmin && typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `spacehome-layout-${org.id}`,
            JSON.stringify(next),
          );
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }

  const ctx = { nick, org, station, counts, viewer };

  return (
    <div className="min-h-screen bg-slate-950 pb-20 text-white">
      <div className="mx-auto max-w-6xl space-y-5 px-4 pt-8 md:px-6">
        {/* Cards FIXOS no topo (não-arrastáveis) */}
        <div className="grid gap-5">{renderCard("header", ctx)}</div>
        <div className="grid gap-5">{renderCard("space-station", ctx)}</div>

        {/* Cards arrastáveis (admin) — exibidos sequencialmente em
            full-width pra simplificar o DnD vertical. Visitantes
            não-admin veem o mesmo conteúdo, só sem o "handle". */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={order}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-5">
              {order.map((card) => (
                <SortableCard
                  key={card}
                  id={card}
                  draggable={viewer.isAdmin}
                >
                  {renderCard(card, ctx)}
                </SortableCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Botão "Adicionar" — só pra admin */}
        {viewer.isAdmin && (
          <div>
            <AddCardButton />
          </div>
        )}
      </div>

      <NasaFooterPublic />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Wrapper que adiciona o handle de drag ao redor de cada card.
   Quando draggable=false, renderiza o card sem qualquer overhead.
   ────────────────────────────────────────────────────────────────── */
function SortableCard({
  id,
  draggable,
  children,
}: {
  id: SpaceCardType;
  draggable: boolean;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !draggable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  if (!draggable) {
    return <>{children}</>;
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <button
        type="button"
        aria-label="Arrastar pra reordenar"
        className="absolute -left-7 top-3 hidden cursor-grab rounded-md p-1 text-white/40 transition hover:bg-white/10 hover:text-white active:cursor-grabbing group-hover:flex md:flex"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      {children}
    </div>
  );
}

function renderCard(
  card: SpaceCardType,
  ctx: {
    nick: string;
    org: SpaceShellProps["initialSpace"]["org"];
    station: SpaceShellProps["initialSpace"]["station"];
    counts: SpaceShellProps["initialSpace"]["counts"];
    viewer: SpaceShellProps["initialSpace"]["viewer"];
  },
) {
  switch (card) {
    case "header":
      return (
        <SpaceHeader
          key="header"
          orgId={ctx.org.id}
          name={ctx.org.name}
          slug={ctx.org.slug}
          nick={ctx.nick}
          logo={ctx.org.logo}
          bannerUrl={ctx.org.bannerUrl}
          bio={ctx.org.bio}
          website={ctx.org.website}
          isSpacehomePublic={ctx.org.isSpacehomePublic}
          isViewerAdmin={ctx.viewer.isAdmin}
          isViewerMember={ctx.viewer.isMember}
          followersCount={ctx.counts.followers}
          starsReceived={ctx.station?.starsReceived ?? 0}
        />
      );
    case "organogram":
      return <CardOrganogram key="organogram" nick={ctx.nick} />;
    case "projects":
      return <CardProjects key="projects" nick={ctx.nick} />;
    case "calendar":
      return <CardCalendar key="calendar" nick={ctx.nick} />;
    case "space-station":
      return (
        <CardSpaceStation
          key="space-station"
          nick={ctx.nick}
          isViewerAuthenticated={!!ctx.viewer.userId}
          isViewerMember={ctx.viewer.isMember}
        />
      );
    case "ranking":
      return <CardRanking key="ranking" nick={ctx.nick} />;
    case "followers":
      return <CardFollowers key="followers" nick={ctx.nick} />;
    case "reviews":
      return <CardReviews key="reviews" nick={ctx.nick} />;
    case "nbox":
      return <CardNBox key="nbox" nick={ctx.nick} />;
    case "forms":
      return <CardForms key="forms" nick={ctx.nick} />;
    case "linnker":
      return <CardLinnker key="linnker" nick={ctx.nick} />;
    case "integrations":
      return <CardIntegrations key="integrations" nick={ctx.nick} />;
    case "stars":
      return (
        <CardStars
          key="stars"
          starsReceived={ctx.station?.starsReceived ?? 0}
        />
      );
    case "footer":
      return null; // Footer is rendered outside the grid
    default:
      return (
        <SpaceCard
          key={card}
          title={friendlyTitle(card)}
          subtitle="Em breve"
          isEmpty
          empty="Este bloco estará disponível em breve."
        >
          <></>
        </SpaceCard>
      );
  }
}

function friendlyTitle(card: SpaceCardType): string {
  switch (card) {
    case "organogram":
      return "Organograma";
    case "connected-orgs":
      return "Empresas conectadas";
    case "ranking":
      return "Ranking de membros";
    case "followers":
      return "Seguidores";
    case "nbox":
      return "Arquivos públicos";
    case "forms":
      return "Formulários";
    case "chat":
      return "Atendimento";
    case "linnker":
      return "Linnker";
    case "reviews":
      return "Avaliações";
    case "social-banners":
      return "Redes sociais";
    case "integrations":
      return "Integrações ativas";
    case "stars":
      return "STARs recebidas";
    default:
      return card;
  }
}
