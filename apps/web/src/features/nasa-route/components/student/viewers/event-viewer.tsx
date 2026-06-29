"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Calendar,
  ChevronLeft,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { imgSrc } from "@/features/public-calendar/utils/img-src";

interface Props {
  course: {
    id: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    coverUrl: string | null;
    eventStartsAt: Date | string | null;
    eventEndsAt: Date | string | null;
    eventTimezone: string | null;
    eventLocationNote: string | null;
    creatorOrg?: { id: string; name: string; slug: string; logo: string | null } | null;
    creator?: { id: string; name: string; image: string | null } | null;
  };
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  return v instanceof Date ? v : new Date(v);
}

function formatDateLong(d: Date, tz: string | null): string {
  return d.toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz ?? undefined,
  });
}

interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  ended: boolean;
}

function diff(target: Date | null): CountdownParts {
  if (!target) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, ended: true };
  }
  const totalMs = target.getTime() - Date.now();
  if (totalMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, ended: true };
  }
  const totalSec = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    totalMs,
    ended: false,
  };
}

export function EventViewer({ course }: Props) {
  const startsAt = toDate(course.eventStartsAt);
  const endsAt = toDate(course.eventEndsAt);

  // Re-render a cada segundo pra atualizar countdown
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Polling do status (a cada 30s) — descobre quando libera o link
  const statusQuery = useQuery({
    ...orpc.nasaRoute.getEventStreamUrl.queryOptions({
      input: { courseId: course.id },
    }),
    refetchInterval: 30_000,
  });

  const enterMutation = useMutation({
    ...orpc.nasaRoute.getEventStreamUrl.mutationOptions(),
    onSuccess: (data) => {
      if (!data.streamUrl) {
        toast.error("O link ainda não está liberado");
        return;
      }
      window.open(data.streamUrl, "_blank", "noopener,noreferrer");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Não foi possível abrir o evento.");
    },
  });

  const countdown = diff(startsAt);
  const eventEnded = endsAt ? now > endsAt.getTime() : false;
  const eventStarted = startsAt ? now >= startsAt.getTime() : false;
  const accessible = !!statusQuery.data?.accessible;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {/* Voltar */}
      <Link
        href="/nasa-route"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Voltar pra meus produtos
      </Link>

      {/* Card principal */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {/* Capa */}
        {course.coverUrl ? (
          <div className="relative aspect-video bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc(course.coverUrl)}
              alt={course.title}
              className="absolute inset-0 size-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-video bg-gradient-to-br from-rose-100 to-rose-50 dark:from-rose-900/30 dark:to-rose-950/30" />
        )}

        <div className="space-y-5 p-6">
          <div className="space-y-1">
            <Badge variant="secondary" className="text-xs">
              📅 Evento Online
            </Badge>
            <h1 className="text-2xl font-bold">{course.title}</h1>
            {course.subtitle && (
              <p className="text-muted-foreground">{course.subtitle}</p>
            )}
          </div>

          {course.creatorOrg && (
            <p className="text-xs text-muted-foreground">
              Por <span className="font-medium">{course.creatorOrg.name}</span>
              {course.creator?.name && ` · ${course.creator.name}`}
            </p>
          )}

          {/* Data/hora */}
          {startsAt && (
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
              <Calendar className="mt-0.5 size-4 text-rose-600" />
              <div>
                <p className="font-medium">{formatDateLong(startsAt, course.eventTimezone)}</p>
                {course.eventTimezone && (
                  <p className="text-xs text-muted-foreground">
                    Fuso: {course.eventTimezone}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* CTA principal */}
          {eventEnded ? (
            <div className="rounded-xl border border-muted bg-muted/40 p-6 text-center">
              <p className="text-sm font-semibold">Evento encerrado</p>
              {course.eventLocationNote && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {course.eventLocationNote}
                </p>
              )}
            </div>
          ) : accessible ? (
            <Button
              size="lg"
              className="w-full"
              onClick={() => enterMutation.mutate({ courseId: course.id })}
              disabled={enterMutation.isPending}
            >
              {enterMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Abrindo...
                </>
              ) : (
                <>
                  <Video className="mr-2 size-5" />
                  {eventStarted ? "Entrar no evento" : "Entrar (sala já aberta)"}
                  <ExternalLink className="ml-2 size-4" />
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/60 p-6 text-center dark:border-rose-800/40 dark:bg-rose-900/20">
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-rose-900 dark:text-rose-200">
                <Clock className="size-4" />
                Falta para começar
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "dias", value: countdown.days },
                  { label: "horas", value: countdown.hours },
                  { label: "min", value: countdown.minutes },
                  { label: "seg", value: countdown.seconds },
                ].map((p) => (
                  <div
                    key={p.label}
                    className="rounded-lg bg-white p-3 shadow-sm dark:bg-rose-950/40"
                  >
                    <div className="text-2xl font-bold tabular-nums">
                      {p.value.toString().padStart(2, "0")}
                    </div>
                    <div className="text-[10px] uppercase text-muted-foreground">
                      {p.label}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                O link de transmissão libera 30 minutos antes do início.
              </p>
            </div>
          )}

          {/* Observações */}
          {course.eventLocationNote && !eventEnded && (
            <div className="flex items-start gap-2 rounded-lg border bg-card p-3 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              <p>{course.eventLocationNote}</p>
            </div>
          )}
        </div>
      </div>

      {/* Descrição */}
      {course.description && (
        <div className="rounded-xl border bg-card p-6">
          <p className="mb-3 text-sm font-semibold">Sobre o evento</p>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-muted-foreground">
            {course.description}
          </div>
        </div>
      )}
    </div>
  );
}
