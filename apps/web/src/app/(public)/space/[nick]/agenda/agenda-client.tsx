"use client";

import Link from "next/link";
import Image from "next/image";
import { NasaFooterPublic } from "@/components/nasa-footer-public";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CalendarDays } from "lucide-react";

export interface AgendaEvent {
  id: string;
  publicSlug: string | null;
  title: string;
  description: string | null;
  coverImage: string | null;
  startDate: string | null;
  endDate: string | null;
  publishedAt: string | null;
  eventCategory: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  viewCount: number;
  likesCount: number;
  registrationUrl: string | null;
}

interface Props {
  nick: string;
  org: { id: string; name: string; logo: string | null };
  initialEvents: AgendaEvent[];
}

export function AgendaClient({ nick, org, initialEvents }: Props) {
  const events = initialEvents;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 pt-8 pb-20">
        <div className="mb-6 flex items-center gap-3">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="border-white/20 bg-white/5 text-white hover:bg-white/10"
          >
            <Link href={`/space/${nick}`}>
              <ArrowLeft className="mr-1 size-3" />
              Voltar
            </Link>
          </Button>
        </div>

        <header className="mb-8 flex items-center gap-4">
          {org.logo ? (
            <Image
              src={org.logo}
              alt={org.name}
              width={56}
              height={56}
              className="rounded-xl border border-white/10"
            />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-xl bg-orange-500/20 text-xl font-bold text-orange-300">
              {org.name[0]}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">Agenda · {org.name}</h1>
            <p className="text-sm text-white/60">
              Eventos públicos organizados pela empresa
            </p>
          </div>
        </header>

        {events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-white/50">
            Nenhum evento público agendado.
          </div>
        ) : (
          <ul className="space-y-3">
            {events.map((ev) => {
              if (!ev.startDate) return null;
              const d = new Date(ev.startDate);
              return (
                <li
                  key={ev.id}
                  className="flex gap-4 rounded-xl border border-white/5 bg-white/5 p-4 transition hover:border-orange-500/30"
                >
                  <div className="flex w-20 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-900 p-3">
                    <span className="text-xs uppercase text-orange-400">
                      {d.toLocaleString("pt-BR", { month: "short" })}
                    </span>
                    <span className="text-3xl font-bold leading-none">
                      {d.getDate()}
                    </span>
                    <span className="text-[10px] text-white/50">
                      {d.getFullYear()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold">{ev.title}</p>
                    {ev.description && (
                      <p className="line-clamp-2 text-sm text-white/60">
                        {ev.description}
                      </p>
                    )}
                    <p className="mt-1 flex items-center gap-2 text-xs text-white/50">
                      <CalendarDays className="size-3" />
                      {d.toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {ev.city && <span>· {ev.city}</span>}
                      {ev.eventCategory && <span>· {ev.eventCategory}</span>}
                    </p>
                  </div>
                  {ev.publicSlug && (
                    <Button
                      asChild
                      size="sm"
                      className="self-center bg-orange-500 hover:bg-orange-600"
                    >
                      <Link href={`/e/${ev.publicSlug}`}>Ver detalhes</Link>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <NasaFooterPublic />
    </div>
  );
}
