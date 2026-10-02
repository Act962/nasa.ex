"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { SpaceCard } from "../space-card";
import { Button } from "@/components/ui/button";
import { CalendarDays, ExternalLink, Plus } from "lucide-react";

interface CardCalendarProps {
  nick: string;
}

/**
 * Calendário PRÓPRIO da empresa — mês compacto + link para a agenda
 * completa. NÃO é o /calendario global.
 */
export function CardCalendar({ nick }: CardCalendarProps) {
  const session = authClient.useSession();
  const isAuthenticated = !!session.data?.user?.id;

  const { data, isLoading } = useQuery(
    orpc.public.space.listSpaceActions.queryOptions({
      input: { nick, limit: 6 },
    }),
  );

  const events = data?.events ?? [];

  return (
    <SpaceCard
      title="Agenda da empresa"
      subtitle="Próximos eventos públicos"
      action={
        <Button
          asChild
          size="sm"
          variant="outline"
        >
          <Link href={`/space/${nick}/agenda`}>
            Ver agenda completa
            <ExternalLink className="ml-1 size-3" />
          </Link>
        </Button>
      }
      isEmpty={!isLoading && events.length === 0}
      empty={
        isAuthenticated
          ? "Você ainda não publicou eventos."
          : "Nenhum evento público agendado."
      }
      emptyAction={
        isAuthenticated ? (
          <Button asChild size="sm" >
            <Link href="/agendas">
              <Plus className="mr-1 size-4" />
              Criar meu primeiro agendamento
            </Link>
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-16 animate-pulse rounded-xl bg-muted/50" />
          <div className="h-16 animate-pulse rounded-xl bg-muted/50" />
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => {
            if (!ev.startDate) return null;
            const date = new Date(ev.startDate);
            const day = date.getDate();
            const month = date.toLocaleString("pt-BR", { month: "short" });
            return (
              <li
                key={ev.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-muted/50 p-3 transition hover:border-info/30"
              >
                <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-background/60 p-2 text-center">
                  <span className="text-[10px] uppercase text-info">
                    {month}
                  </span>
                  <span className="text-lg font-bold leading-none text-foreground">
                    {day}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {ev.title}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="size-3" />
                    {ev.city ?? "Online"}
                    {ev.eventCategory && <span>· {ev.eventCategory}</span>}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SpaceCard>
  );
}
