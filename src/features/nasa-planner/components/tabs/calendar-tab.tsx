"use client";

import { useState } from "react";
import { LinkIcon, CheckCircle2Icon, CopyIcon, AlertCircleIcon } from "lucide-react";
import { Calendar } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  useNasaPlannerPosts, useNasaPlannerCards, useCreateCalendarShare,
} from "../../hooks/use-nasa-planner";
import { calendarLocalizer } from "../../constants";

export function CalendarTab({ plannerId }: { plannerId: string }) {
  const { posts } = useNasaPlannerPosts(plannerId);
  const { cards } = useNasaPlannerCards({ plannerId });
  const createShare = useCreateCalendarShare();

  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const events = [
    ...posts
      .filter((p: any) => p.scheduledAt || p.publishedAt)
      .map((p: any) => ({
        id: `post-${p.id}`,
        title: `[Post] ${p.title}`,
        start: new Date(p.scheduledAt ?? p.publishedAt),
        end: new Date(p.scheduledAt ?? p.publishedAt),
        resource: { type: "post", data: p },
      })),
    ...cards
      .filter((c: any) => c.dueDate)
      .map((c: any) => ({
        id: `card-${c.id}`,
        title: `[Card] ${c.title}`,
        start: new Date(c.dueDate),
        end: new Date(c.dueDate),
        resource: { type: "card", data: c },
      })),
  ];

  const eventStyleGetter = (event: any) => ({
    style: {
      backgroundColor: event.resource?.type === "card" ? "#7c3aed" : "#db2777",
      borderRadius: "4px",
      border: "none",
      color: "white",
      fontSize: "12px",
    },
  });

  const handleShare = async () => {
    const result = await createShare.mutateAsync({ plannerId });
    if ((result as any)?.shareUrl) setShareUrl((result as any).shareUrl);
    setShareOpen(true);
  };

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-pink-500 shrink-0" />Posts
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-violet-600 shrink-0" />Cards
          </span>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={handleShare} disabled={createShare.isPending}>
          <LinkIcon className="size-3.5" />
          {createShare.isPending ? "Gerando..." : "Compartilhar"}
        </Button>
      </div>

      <div className="flex-1 p-4 min-h-0">
        <Calendar
          localizer={calendarLocalizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "100%" }}
          culture="pt-BR"
          date={currentDate}
          onNavigate={setCurrentDate}
          eventPropGetter={eventStyleGetter}
          messages={{
            next: "Próximo", previous: "Anterior", today: "Hoje",
            month: "Mês", week: "Semana", day: "Dia", agenda: "Agenda",
            date: "Data", time: "Hora", event: "Evento",
            noEventsInRange: "Sem eventos neste período",
          }}
        />
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Link de Compartilhamento</DialogTitle></DialogHeader>
          {shareUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Compartilhe este link para que outros visualizem o calendário.
              </p>
              <div className="flex items-center gap-2">
                <Input value={shareUrl} readOnly className="text-xs" />
                <Button size="icon" variant="outline" onClick={handleCopy}>
                  {copied ? <CheckCircle2Icon className="size-4" /> : <CopyIcon className="size-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircleIcon className="size-4" />Não foi possível gerar o link.
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShareOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
