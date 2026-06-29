"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { APPS } from "@/features/apps/components/apps-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ImageIcon,
  ExternalLink,
  Calendar,
  AppWindow,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { statusMap } from "./types";
import { ImagePreview } from "./image-preview";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUpdateSupportTicketStatus } from "../../hooks/use-suport";

type Ticket = {
  id: string;
  appId: string;
  user?: {
    name: string | null;
    email: string | null;
  } | null;
  improvement: string;
  imageUrl?: string | null;
  createdAt: string | Date;
  status: string;
};

interface ViewSupportSheetProps {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewSupportSheet({
  ticket,
  open,
  onOpenChange,
}: ViewSupportSheetProps) {
  const updateStatus = useUpdateSupportTicketStatus();
  const [localStatus, setLocalStatus] = useState(ticket?.status || "PENDING");

  useEffect(() => {
    if (ticket?.status) {
      setLocalStatus(ticket.status);
    }
  }, [ticket?.status]);

  if (!ticket) return null;

  const appInfo = APPS.find((a) => a.id === ticket.appId);
  const AppIcon = appInfo?.icon;
  const statusInfo = statusMap[localStatus] || {
    label: localStatus,
    colorClass: "bg-muted text-muted-foreground",
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleStatusChange = (newStatus: string) => {
    if (localStatus !== newStatus) {
      setLocalStatus(newStatus);
      updateStatus.mutate({ id: ticket.id, status: newStatus as any });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="dark text-foreground flex flex-col sm:max-w-md w-full p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center justify-between gap-4 pr-6">
            <SheetTitle className="text-lg">Detalhes da Solicitação</SheetTitle>
            <DropdownMenu>
              <DropdownMenuTrigger disabled={updateStatus.isPending} asChild>
                <Badge
                  variant="outline"
                  className={`${statusInfo.colorClass} cursor-pointer flex items-center gap-1.5 transition-opacity hover:opacity-80`}
                >
                  {updateStatus.isPending && (
                    <Loader2 className="size-3 animate-spin" />
                  )}
                  {statusInfo.label}
                  <ChevronDown className="size-3 opacity-50" />
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="dark text-foreground">
                {Object.entries(statusMap).map(([key, value]) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => handleStatusChange(key)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Badge variant="outline" className={value.colorClass}>
                      {value.label}
                    </Badge>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <SheetDescription>
            ID do ticket: <span className="font-mono text-xs">{ticket.id}</span>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 h-full pb-8">
          <div className="p-6 space-y-8">
            {/* Usuário */}
            <div className="space-y-3">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                Autor da Solicitação
              </Label>
              <div className="flex items-center gap-3 bg-muted/10 p-3 rounded-lg border border-border">
                <Avatar className="size-10 border border-border">
                  <AvatarFallback className="bg-foreground/5 text-foreground text-xs font-medium">
                    {ticket.user?.name ? getInitials(ticket.user.name) : "??"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-medium text-sm text-foreground/90">
                    {ticket.user?.name || "Usuário Desconhecido"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {ticket.user?.email || "Sem e-mail registrado"}
                  </span>
                </div>
              </div>
            </div>

            {/* App / Contexto */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                  Aplicativo
                </Label>
                <div className="flex items-center gap-2">
                  {AppIcon ? (
                    <div className="p-1.5 bg-card rounded-md border border-border text-foreground/40 [&>svg]:size-4">
                      <AppIcon />
                    </div>
                  ) : (
                    <div className="p-1.5 bg-card rounded-md border border-border">
                      <AppWindow className="size-4 text-foreground/80" />
                    </div>
                  )}
                  <span className="font-medium text-sm">
                    {appInfo?.name || ticket.appId}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                  Data de Envio
                </Label>
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {format(new Date(ticket.createdAt), "dd MMM yyyy, HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Descrição / Sugestão */}
            <div className="space-y-3">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                Descrição da Sugestão / Melhoria
              </Label>
              <div className="bg-muted/10 p-4 rounded-lg border border-border text-sm leading-relaxed whitespace-pre-wrap">
                {ticket.improvement}
              </div>
            </div>

            {/* Mídia Anexa */}
            <div className="space-y-3 pb-6">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold flex items-center gap-2">
                <ImageIcon className="size-3.5" />
                Mídia Anexa
              </Label>
              {ticket.imageUrl ? (
                <ImagePreview imageUrl={ticket.imageUrl} />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 border border-dashed border-border rounded-lg bg-muted/10">
                  <ImageIcon className="size-8 text-muted-foreground/30 mb-2" />
                  <span className="text-sm text-muted-foreground font-medium">
                    Nenhum anexo fornecido
                  </span>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
