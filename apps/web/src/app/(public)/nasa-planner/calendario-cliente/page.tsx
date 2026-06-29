"use client";

import { useState } from "react";
import { CalendarIcon, RocketIcon, BuildingIcon, ClockIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicCalendar } from "@/features/nasa-planner/hooks/use-campaign-planner";

const EVENT_TYPE_LABELS: Record<string, string> = {
  TRAINING: "📚 Treinamento",
  STRATEGIC_MEETING: "🤝 Reunião Estratégica",
  KICKOFF: "🚀 Kickoff",
  REVIEW: "📊 Review",
  PRESENTATION: "🎤 Apresentação",
  DEADLINE: "⏰ Prazo",
};

function PublicCalendarView({ code }: { code: string }) {
  const { publicCalendar, isLoading, error } = usePublicCalendar(code);

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );

  if (error || !publicCalendar) return (
    <div className="text-center py-12">
      <div className="size-16 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-4">
        <CalendarIcon className="size-8 text-red-500" />
      </div>
      <h2 className="text-lg font-semibold text-red-600">Código inválido ou expirado</h2>
      <p className="text-muted-foreground text-sm mt-1">Verifique o código com sua agência e tente novamente.</p>
    </div>
  );

  const now = new Date();
  const upcoming = (publicCalendar.events ?? []).filter((e: any) => new Date(e.scheduledAt) >= now);
  const past = (publicCalendar.events ?? []).filter((e: any) => new Date(e.scheduledAt) < now);

  return (
    <div className="space-y-6">
      {/* Campaign info */}
      <div className="rounded-2xl p-6 text-white" style={{ backgroundColor: (publicCalendar as any).color ?? "#7c3aed" }}>
        <div className="flex items-start gap-3">
          <div className="size-12 rounded-xl bg-white/20 flex items-center justify-center">
            <RocketIcon className="size-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{(publicCalendar as any).title}</h2>
            {(publicCalendar as any).clientName && (
              <div className="flex items-center gap-1.5 text-white/80 text-sm mt-0.5">
                <BuildingIcon className="size-3.5" /> {(publicCalendar as any).clientName}
              </div>
            )}
            {((publicCalendar as any).startDate || (publicCalendar as any).endDate) && (
              <div className="flex items-center gap-1.5 text-white/80 text-sm mt-0.5">
                <CalendarIcon className="size-3.5" />
                {(publicCalendar as any).startDate && new Date((publicCalendar as any).startDate).toLocaleDateString("pt-BR")}
                {(publicCalendar as any).endDate && ` → ${new Date((publicCalendar as any).endDate).toLocaleDateString("pt-BR")}`}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm font-medium">{(publicCalendar.events ?? []).length} eventos</div>
          <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm font-medium">{upcoming.length} próximos</div>
        </div>
      </div>

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Próximos Eventos</h3>
          <div className="space-y-2">
            {upcoming.map((ev: any) => (
              <Card key={ev.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{ev.title}</span>
                        <Badge variant="secondary" className="text-xs">{EVENT_TYPE_LABELS[ev.eventType] ?? ev.eventType}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><ClockIcon className="size-3" />{new Date(ev.scheduledAt).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}</span>
                        <span>{ev.durationMinutes}min</span>
                      </div>
                      {ev.description && <p className="text-xs text-muted-foreground mt-1">{ev.description}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Past events */}
      {past.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 text-muted-foreground">Eventos Realizados</h3>
          <div className="space-y-2 opacity-60">
            {past.map((ev: any) => (
              <Card key={ev.id} className="border-dashed">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm line-through text-muted-foreground">{ev.title}</span>
                    <span className="text-xs text-muted-foreground">{new Date(ev.scheduledAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {(publicCalendar.events ?? []).length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <CalendarIcon className="size-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum evento cadastrado ainda.</p>
        </div>
      )}
    </div>
  );
}

export default function PublicCalendarClientPage() {
  const [inputCode, setInputCode] = useState("");
  const [activeCode, setActiveCode] = useState("");

  const handleSearch = () => {
    if (inputCode.trim()) setActiveCode(inputCode.trim().toUpperCase());
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="size-16 rounded-2xl bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center mx-auto mb-4">
            <RocketIcon className="size-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Calendário da Campanha</h1>
          <p className="text-muted-foreground text-sm mt-1">Acesse o calendário de sua campanha com o código fornecido pela sua agência.</p>
        </div>

        {/* Code input */}
        <div className="flex gap-2 mb-8">
          <Input
            placeholder="Ex: NASA-ABCD12"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="font-mono text-center text-lg tracking-widest"
          />
          <Button onClick={handleSearch} disabled={!inputCode.trim()} className="gap-1.5">
            <SearchIcon className="size-4" /> Acessar
          </Button>
        </div>

        {/* Calendar */}
        {activeCode && <PublicCalendarView code={activeCode} />}
      </div>
    </div>
  );
}
