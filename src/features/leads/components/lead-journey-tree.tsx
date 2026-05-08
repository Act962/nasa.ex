"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc";
import {
  ArrowRight,
  ClipboardList,
  FileUp,
  GitBranch,
  Layers,
  StickyNote,
  Tag as TagIcon,
  TimerOff,
  User as UserIcon,
} from "lucide-react";

type JourneyEvent = {
  id: string;
  action: string;
  eventType?: string | null;
  notes?: string | null;
  createdAt: Date | string;
  previousStatusId?: string | null;
  newStatusId?: string | null;
  previousTrackingId?: string | null;
  newTrackingId?: string | null;
  previousResponsibleId?: string | null;
  newResponsibleId?: string | null;
  metadata?: unknown;
  user?: { id: string; name: string; image?: string | null } | null;
};

const EVENT_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  STATUS_CHANGE: { label: "Mudou de etapa", icon: Layers, color: "text-sky-600" },
  TRACKING_CHANGE: { label: "Mudou de setor", icon: GitBranch, color: "text-violet-600" },
  RESPONSIBLE_CHANGE: { label: "Mudou de responsável", icon: UserIcon, color: "text-amber-600" },
  FORM_SUBMITTED: { label: "Formulário respondido", icon: ClipboardList, color: "text-emerald-600" },
  TAG_ADDED: { label: "Tag adicionada", icon: TagIcon, color: "text-pink-600" },
  TAG_REMOVED: { label: "Tag removida", icon: TagIcon, color: "text-rose-600" },
  FILE_UPLOADED: { label: "Arquivo enviado", icon: FileUp, color: "text-blue-600" },
  NOTE: { label: "Nota", icon: StickyNote, color: "text-muted-foreground" },
  PUBLIC_LINK_VIEWED: { label: "Cliente abriu o link", icon: UserIcon, color: "text-cyan-600" },
  SLA_BREACHED: { label: "SLA estourou", icon: TimerOff, color: "text-red-600" },
  ACTION_CHANGE: { label: "Ação alterada", icon: Layers, color: "text-muted-foreground" },
};

export function LeadJourneyTree({
  leadId,
  open,
  onOpenChange,
}: {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    ...orpc.leads.listJourney.queryOptions({ input: { leadId } }),
    enabled: open,
  });

  const events = (data?.events as unknown as JourneyEvent[]) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Jornada do Lead
          </DialogTitle>
          <DialogDescription>
            Linha do tempo completa de mudanças, responsáveis e respostas.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 max-h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Spinner />
            </div>
          ) : events.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              Sem eventos registrados ainda.
            </p>
          ) : (
            <ol className="relative ml-4 border-l border-foreground/10 py-2 pl-6 space-y-6">
              {events.map((evt) => {
                const meta = EVENT_META[evt.eventType ?? "ACTION_CHANGE"] ?? EVENT_META.ACTION_CHANGE;
                const Icon = meta.icon;
                return (
                  <li key={evt.id} className="relative">
                    <span
                      className={`absolute -left-[33px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-background border-2 border-foreground/20 ${meta.color}`}
                    >
                      <Icon className="w-3 h-3" />
                    </span>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium">{meta.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(evt.createdAt), "dd/MM/yyyy HH:mm", {
                            locale: ptBR,
                          })}
                        </span>
                      </div>

                      {(evt.previousStatusId || evt.newStatusId) && evt.eventType === "STATUS_CHANGE" && (
                        <TransitionRow from={evt.previousStatusId} to={evt.newStatusId} kind="status" />
                      )}
                      {(evt.previousTrackingId || evt.newTrackingId) && evt.eventType === "TRACKING_CHANGE" && (
                        <TransitionRow from={evt.previousTrackingId} to={evt.newTrackingId} kind="tracking" />
                      )}
                      {(evt.previousResponsibleId || evt.newResponsibleId) &&
                        evt.eventType === "RESPONSIBLE_CHANGE" && (
                          <TransitionRow
                            from={evt.previousResponsibleId}
                            to={evt.newResponsibleId}
                            kind="user"
                          />
                        )}

                      {evt.notes && (
                        <p className="text-sm text-muted-foreground">{evt.notes}</p>
                      )}

                      {evt.user && (
                        <div className="flex items-center gap-2 mt-1">
                          <Avatar className="h-5 w-5">
                            {evt.user.image && <AvatarImage src={evt.user.image} />}
                            <AvatarFallback className="text-[10px]">
                              {evt.user.name?.[0] ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">
                            por {evt.user.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function TransitionRow({
  from,
  to,
  kind,
}: {
  from?: string | null;
  to?: string | null;
  kind: "status" | "tracking" | "user";
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Badge variant="outline" className="font-mono">
        {from ? shorten(from) : kind === "user" ? "Sem responsável" : "—"}
      </Badge>
      <ArrowRight className="w-3 h-3 text-muted-foreground" />
      <Badge variant="secondary" className="font-mono">
        {to ? shorten(to) : kind === "user" ? "Sem responsável" : "—"}
      </Badge>
    </div>
  );
}

function shorten(id: string): string {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-3)}` : id;
}
