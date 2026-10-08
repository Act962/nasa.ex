"use client";

import { CalendarIcon, PlusIcon, Trash2Icon, LayoutDashboardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryPlatformIntegrations } from "@/features/integrations/hooks/use-integrations";
import { useWorkspaces, useWorkspaceColumnOptions } from "@/features/workspace/hooks/use-workspace";
import { EVENT_TYPES, type DraftSetter, type EventDraft } from "./wizard-options";

/** Passo 2 do assistente de campanha: ações e datas estratégicas. */

interface StepEventsProps {
  newEvent: EventDraft;
  setNewEvent: DraftSetter<EventDraft>;
  events: EventDraft[];
  setEvents: DraftSetter<EventDraft[]>;
  onAddEvent: () => void;
}

export function StepEvents({ newEvent, setNewEvent, events, setEvents, onAddEvent }: StepEventsProps) {
  const { data: integrationsData } = useQueryPlatformIntegrations();
  const hasGoogleCalendar = (integrationsData?.integrations ?? []).some(
    (integration) => integration.platform === "GOOGLE_CALENDAR" && integration.isActive,
  );
  const { data: workspacesData } = useWorkspaces();
  const workspaces = workspacesData?.workspaces ?? [];
  const { columns: eventColumns } = useWorkspaceColumnOptions(newEvent.workspaceId ?? "");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Adicione as ações e datas estratégicas da campanha.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={newEvent.eventType} onValueChange={(v) => setNewEvent((e) => ({ ...e, eventType: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Data/Hora *</Label>
          <Input type="datetime-local" value={newEvent.scheduledAt} onChange={(e) => setNewEvent((ev) => ({ ...ev, scheduledAt: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Título *</Label>
          <Input placeholder="Ex: Reunião de kickoff" value={newEvent.title} onChange={(e) => setNewEvent((ev) => ({ ...ev, title: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Duração (min)</Label>
          <Input type="number" value={newEvent.durationMinutes} onChange={(e) => setNewEvent((ev) => ({ ...ev, durationMinutes: +e.target.value }))} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Link da Reunião</Label>
        <div className="flex gap-2">
          <Input
            placeholder="https://meet.google.com/..."
            value={newEvent.meetingLink}
            onChange={(e) => setNewEvent((ev) => ({ ...ev, meetingLink: e.target.value }))}
            className="flex-1"
          />
          {hasGoogleCalendar && newEvent.title && newEvent.scheduledAt && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs text-info border-info/30 hover:bg-info/10"
              onClick={() => {
                const start = new Date(newEvent.scheduledAt);
                const end = new Date(start.getTime() + newEvent.durationMinutes * 60000);
                const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
                const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(newEvent.title)}&dates=${fmt(start)}/${fmt(end)}${newEvent.meetingLink ? `&location=${encodeURIComponent(newEvent.meetingLink)}` : ""}`;
                window.open(url, "_blank");
              }}
            >
              <CalendarIcon className="size-3.5" />
              Google Calendar
            </Button>
          )}
        </div>
        {!hasGoogleCalendar && (
          <p className="text-xs text-muted-foreground">
            <a href="/settings/integrations" target="_blank" className="underline text-info">Conecte o Google Calendar</a> para criar eventos diretamente.
          </p>
        )}
      </div>
      {/* Workspace + Column for event */}
      <div className="border rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
          <LayoutDashboardIcon className="size-3.5" /> Refletir no Workspace <span className="text-[10px]">(opcional)</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Select value={newEvent.workspaceId ?? "__none__"} onValueChange={(v) => setNewEvent((e) => ({ ...e, workspaceId: v === "__none__" ? undefined : v, columnId: undefined }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Workspace" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhum</SelectItem>
              {workspaces.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={newEvent.columnId ?? ""} onValueChange={(v) => setNewEvent((e) => ({ ...e, columnId: v || undefined }))} disabled={!newEvent.workspaceId}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status / Coluna" /></SelectTrigger>
            <SelectContent>
              {eventColumns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onAddEvent} disabled={!newEvent.title || !newEvent.scheduledAt} className="gap-1">
        <PlusIcon className="size-3.5" /> Adicionar Ação
      </Button>
      {events.length > 0 && (
        <div className="space-y-2">
          {events.map((ev, i) => (
            <div key={i} className="flex items-center justify-between text-sm bg-muted/50 px-3 py-2 rounded-lg">
              <div>
                <span className="font-medium">{EVENT_TYPES.find((t) => t.value === ev.eventType)?.emoji} {ev.title}</span>
                <span className="text-muted-foreground ml-2">{new Date(ev.scheduledAt).toLocaleDateString("pt-BR")}</span>
              </div>
              <Button variant="ghost" size="icon" className="size-6" onClick={() => setEvents((e) => e.filter((_, j) => j !== i))}>
                <Trash2Icon className="size-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
