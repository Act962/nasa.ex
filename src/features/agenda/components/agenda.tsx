"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Calendar,
  Users,
  Trash2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { CreateAgendaModal } from "./create-agenda-modal";

import { ScheduleEvent } from "../types/types";

const MOCK_EVENTS: ScheduleEvent[] = [
  {
    id: "1",
    title: "Consultoria de TI",
    description:
      "Sessão estratégica para discutir infraestrutura, escalabilidade e segurança da informação para novos projetos.",
    duration: 60,
    location: "Google Meet",
    createdAt: new Date().toISOString(),
    availability: [],
  },
  {
    id: "2",
    title: "Mentoria Fullstack",
    description:
      "Acompanhamento individual focado em tecnologias modernas como React, Next.js e Node.js.",
    duration: 90,
    location: "Zoom",
    createdAt: new Date().toISOString(),
    availability: [],
  },
  {
    id: "3",
    title: "Reunião de Alinhamento",
    description:
      "Conversa rápida para definir prioridades da semana e resolver impedimentos da equipe.",
    duration: 30,
    location: "Escritório Central",
    createdAt: new Date().toISOString(),
    availability: [],
  },
];

export function Agenda() {
  const [open, setOpen] = useState(false);
  const events = MOCK_EVENTS;

  const handleDelete = (id: string) => {};

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/agendar/${id}`;
    navigator.clipboard.writeText(url);
    toast("Link copiado!");
  };

  return (
    <div className="w-full">
      <div className="mx-auto flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <Calendar className="size-4" />
          <h1 className="text-xl font-bold">Gerenciador de Agenda</h1>
        </div>
        <CreateAgendaModal open={open} onOpenChange={setOpen}>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Evento
          </Button>
        </CreateAgendaModal>
      </div>

      <main className="container mx-auto px-4 py-8">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">Nenhum evento criado</h2>
            <p className="mb-6 text-muted-foreground">
              Crie seu primeiro evento e configure as disponibilidades.
            </p>
            <Link href="/admin/evento/novo">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Primeiro Evento
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event: ScheduleEvent) => {
              const bookings =
                event.id === "1"
                  ? [1, 2, 3]
                  : event.id === "2"
                    ? [1, 2, 3, 4, 5]
                    : [1];
              return (
                <Card
                  key={event.id}
                  className="group transition-shadow hover:shadow-md"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{event.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {event.duration} min • {event.location}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        <Users className="h-3 w-3" />
                        {bookings.length}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {event.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <CreateAgendaModal open={open} onOpenChange={setOpen}>
                        <Button variant="outline" size="sm" className="gap-1.5">
                          Editar
                        </Button>
                      </CreateAgendaModal>
                      <Link href={`/admin/agendamentos/${event.id}`}>
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          Agendamentos
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => copyLink(event.id)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Link href={`/agendar/${event.id}`} target="_blank">
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(event.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
