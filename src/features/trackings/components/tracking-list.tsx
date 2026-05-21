"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import dayjs from "dayjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import "dayjs/locale/pt-br";
import { useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Folder, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTracking } from "@/hooks/use-tracking-modal";
import { PatternsSection } from "@/features/admin/components/patterns-section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useConstructUrl } from "@/hooks/use-construct-url";

dayjs.extend(utc);
dayjs.extend(relativeTime);
dayjs.locale("pt-BR");

type TrackingDashboardItem = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: Date | string | number;
  cardBorderColor?: string | null;
  cardBackgroundImage?: string | null;
  cardBackgroundBlur?: number;
  cardBackgroundOpacity?: number;
  participants: Array<{
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: string;
    isCreator: boolean;
    isOnline: boolean;
  }>;
  statuses: Array<{
    id: string;
    name: string;
    color: string | null;
    leadCount: number;
  }>;
  relatedTrackings: Array<{ id: string; name: string }>;
};

const MAX_VISIBLE_AVATARS = 5;

function TrackingCard({ tracking }: { tracking: TrackingDashboardItem }) {
  const bgUrl = useConstructUrl(tracking.cardBackgroundImage || "");

  const visibleParticipants = tracking.participants.slice(
    0,
    MAX_VISIBLE_AVATARS,
  );
  const overflowCount = Math.max(
    0,
    tracking.participants.length - MAX_VISIBLE_AVATARS,
  );
  const borderColor = tracking.cardBorderColor || undefined;
  const hasRelated = tracking.relatedTrackings.length > 0;
  // Defaults sensatos quando o lead não tem config: blur 8px, opacity 25%.
  const bgBlur = tracking.cardBackgroundBlur ?? 8;
  const bgOpacity = (tracking.cardBackgroundOpacity ?? 25) / 100;

  return (
    <TooltipProvider delayDuration={250}>
      <div className="relative h-full">
        <Link href={`/tracking/${tracking.id}`} className="block h-full">
          <Card
            className="cursor-pointer h-full transition-colors hover:bg-accent/40 relative overflow-hidden"
            style={
              borderColor
                ? {
                    borderColor,
                    borderWidth: 2,
                    boxShadow: `0 0 0 1px ${borderColor}40`,
                  }
                : undefined
            }
          >
            {/* Background image (com blur) — fica atrás de tudo. Aplicado
                via div absoluto pra não vazar pra fora do border. */}
            {tracking.cardBackgroundImage && (
              <div
                aria-hidden
                className="absolute inset-0 z-0"
                style={{
                  backgroundImage: `url(${bgUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: `blur(${bgBlur}px)`,
                  transform: "scale(1.1)",
                  opacity: bgOpacity,
                }}
              />
            )}

            <div className="relative z-10">
              <CardHeader>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="wrap-break-word">
                      {tracking.name}
                    </CardTitle>
                    <CardDescription className="wrap-break-word line-clamp-2">
                      {tracking.description || "Sem descrição"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Status tarjas — 4 por linha, tamanho fixo. Mostra
                    "<count> · <Nome do status>" truncado a 30 caracteres
                    com tooltip mostrando o nome completo + label "leads". */}
                {tracking.statuses.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {tracking.statuses.map((s) => {
                      const truncated =
                        s.name.length > 30
                          ? `${s.name.slice(0, 29)}…`
                          : s.name;
                      return (
                        <Tooltip key={s.id}>
                          <TooltipTrigger asChild>
                            <span
                              className="h-6 px-2 rounded-full text-[10px] font-semibold text-white flex items-center gap-1.5 min-w-0"
                              style={{
                                background: s.color || "#64748b",
                              }}
                            >
                              <span className="tabular-nums shrink-0">
                                {s.leadCount}
                              </span>
                              <span className="text-white/40 shrink-0">·</span>
                              <span className="truncate flex-1 min-w-0">
                                {truncated}
                              </span>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <span className="text-xs">
                              <strong>{s.name}</strong>: {s.leadCount}{" "}
                              {s.leadCount === 1 ? "lead" : "leads"}
                            </span>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}

                {/* Avatares dos participantes + count overflow */}
                {tracking.participants.length > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex -space-x-2">
                      {visibleParticipants.map((p) => (
                        <Tooltip key={p.id}>
                          <TooltipTrigger asChild>
                            <span className="relative">
                              <Avatar
                                className="size-8"
                                style={{
                                  // Criador: borda azul. Demais: borda
                                  // branca/cinza. Se há cor de tema do
                                  // card, usamos `cardBorderColor` pro
                                  // criador pra reforçar coesão visual.
                                  outline: `2px solid ${
                                    p.isCreator
                                      ? borderColor || "#3b82f6"
                                      : "rgba(255,255,255,0.9)"
                                  }`,
                                  outlineOffset: -1,
                                }}
                              >
                                {p.image && <AvatarImage src={p.image} alt={p.name} />}
                                <AvatarFallback className="text-[10px] bg-foreground/10">
                                  {p.name?.[0]?.toUpperCase() ?? "?"}
                                </AvatarFallback>
                              </Avatar>
                              {p.isOnline && (
                                <span
                                  className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 border-2 border-background"
                                  title="Online"
                                />
                              )}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <div className="flex flex-col text-xs">
                              <span className="font-medium">
                                {p.name}
                                {p.isCreator && (
                                  <span className="ml-1 text-[10px] text-blue-500">
                                    · criador
                                  </span>
                                )}
                              </span>
                              <span className="text-muted-foreground">
                                {p.email}
                              </span>
                              {p.isOnline && (
                                <span className="text-emerald-500">
                                  • online agora
                                </span>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {overflowCount > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="size-8 inline-flex items-center justify-center rounded-full bg-foreground/10 text-[11px] font-medium border-2 border-background">
                              +{overflowCount}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <div className="flex flex-col text-xs gap-0.5">
                              {tracking.participants
                                .slice(MAX_VISIBLE_AVATARS)
                                .map((p) => (
                                  <span key={p.id}>
                                    {p.name}
                                    {p.isOnline && (
                                      <span className="ml-1 text-emerald-500">
                                        •
                                      </span>
                                    )}
                                  </span>
                                ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {dayjs(tracking.createdAt).fromNow()}
                    </span>
                  </div>
                )}

                {tracking.participants.length === 0 && (
                  <div className="flex justify-end">
                    <span className="text-[11px] text-muted-foreground">
                      Criado {dayjs(tracking.createdAt).fromNow()}
                    </span>
                  </div>
                )}
              </CardContent>
            </div>
          </Card>
        </Link>

        {/* Ícone de sincronização (automação cruzada com outros trackings)
            — fica POR CIMA do border do card. Tooltip mostra os trackings
            relacionados. Click NÃO segue o link do card. */}
        {hasRelated && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="absolute -left-2.5 top-1/2 -translate-y-1/2 z-20 size-7 rounded-full flex items-center justify-center pointer-events-auto"
                style={{
                  background: borderColor || "var(--background)",
                  borderColor: borderColor
                    ? `${borderColor}80`
                    : "rgba(0,0,0,0.2)",
                  borderWidth: 1.5,
                  borderStyle: "solid",
                  color: borderColor ? "#fff" : undefined,
                }}
                aria-label="Tem automação com outros trackings"
              >
                <RefreshCw className="size-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <div className="text-xs">
                <p className="font-semibold mb-1">
                  Automação cruzada com:
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {tracking.relatedTrackings.map((r) => (
                    <li key={r.id}>{r.name}</li>
                  ))}
                </ul>
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Configuração de aparência foi movida pra
            `Tracking > Configurações > Personalização`. */}
      </div>
    </TooltipProvider>
  );
}

export function TrackingList() {
  const searchParams = useSearchParams();
  const query = searchParams?.get("q") ?? "";
  const { onOpen } = useTracking();

  const { data, isLoading } = useSuspenseQuery(
    orpc.tracking.listDashboard.queryOptions(),
  );
  const trackings = (data?.trackings ?? []) as TrackingDashboardItem[];

  const trackingList = query
    ? trackings.filter((tracking) =>
        tracking.name.toLowerCase().includes(query.toLowerCase()),
      )
    : trackings;

  const hasPosts = trackingList.length > 0;

  return (
    <div className="mt-8">
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-full" />
          ))}
        </div>
      )}
      {hasPosts && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {trackingList.map((tracking) => (
            <TrackingCard key={tracking.id} tracking={tracking} />
          ))}
        </div>
      )}
      {!hasPosts && !isLoading && (
        <div className="flex items-center justify-center mt-16">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Folder />
              </EmptyMedia>
              <EmptyTitle>Nenhum tracking encontrado</EmptyTitle>
              <EmptyDescription>
                Você não possui nenhum tracking criado ainda. Comece criando seu
                primeiro tracking
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex gap-2">
                <Button onClick={onOpen}>Criar novo tracking</Button>
              </div>
            </EmptyContent>
          </Empty>
        </div>
      )}
      <PatternsSection
        appType="tracking"
        redirectPath={(id) => `/tracking/${id}`}
      />
    </div>
  );
}
