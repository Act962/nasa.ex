"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Spinner } from "@/components/ui/spinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  computeSlaState,
  formatRemaining,
  slaBadgeColor,
} from "@/features/leads/lib/sla";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, GitBranch, MapPin, Timer } from "lucide-react";
import { pusherClient } from "@/lib/pusher";
import { Badge } from "@/components/ui/badge";

type LeadPublicData = {
  id: string;
  name: string;
  createdAt: Date | string;
  slaDeadline: Date | string | null;
  statusEnteredAt: Date | string | null;
  status: { id: string; name: string; color: string | null };
  tracking: { id: string; name: string };
  responsible: { name: string; image: string | null } | null;
  history: Array<{
    id: string;
    createdAt: Date | string;
    eventType?: string | null;
    previousStatusId?: string | null;
    newStatusId?: string | null;
  }>;
};

export default function PublicLeadPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const queryClient = useQueryClient();

  const queryOpts = orpc.leads.getByPublicToken.queryOptions({
    input: { token },
  });
  const { data, isLoading, isError } = useQuery(queryOpts);

  useEffect(() => {
    if (!token) return;
    const channel = pusherClient.subscribe(`lead-public-${token}`);
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: queryOpts.queryKey });
    };
    channel.bind("update", handler);
    return () => {
      channel.unbind("update", handler);
      pusherClient.unsubscribe(`lead-public-${token}`);
    };
  }, [token, queryClient, queryOpts.queryKey]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  if (isError || !data?.lead) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 text-center">
        <h1 className="text-xl font-semibold mb-2">Link inválido ou expirado</h1>
        <p className="text-sm text-muted-foreground">
          Verifique com o estabelecimento se o link está correto.
        </p>
      </div>
    );
  }

  const lead = data.lead as unknown as LeadPublicData;
  const sla = computeSlaState(lead.statusEnteredAt, lead.slaDeadline);

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <header className="text-center space-y-1 py-4">
          <h1 className="text-2xl font-semibold">Olá, {lead.name}</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe em tempo real o status do seu atendimento.
          </p>
        </header>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              Etapa atual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: lead.status.color ?? "#1447e6" }}
              />
              <div>
                <p className="font-medium">{lead.status.name}</p>
                <p className="text-xs text-muted-foreground">
                  Setor: {lead.tracking.name}
                </p>
              </div>
            </div>

            {lead.slaDeadline && (
              <div
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 ${slaBadgeColor(
                  sla.consumedPct,
                  sla.isBreached,
                )}`}
              >
                <Timer className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {sla.isBreached ? "Tempo excedido" : "Tempo restante"}: {formatRemaining(sla.remainingMs)}
                </span>
              </div>
            )}

            {lead.responsible && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Avatar className="h-7 w-7">
                  {lead.responsible.image && (
                    <AvatarImage src={lead.responsible.image} />
                  )}
                  <AvatarFallback className="text-[11px]">
                    {lead.responsible.name?.[0] ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xs text-muted-foreground">Responsável</p>
                  <p className="text-sm font-medium">{lead.responsible.name}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Linha do tempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative ml-2 border-l border-foreground/10 pl-5 space-y-3">
              {(lead.history ?? []).map((evt) => (
                <li key={evt.id} className="relative">
                  <span className="absolute -left-[27px] top-1 w-3 h-3 rounded-full bg-emerald-500" />
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-sm">
                        {humanizeEvent(evt.eventType)}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(evt.createdAt), "dd/MM HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </li>
              ))}
              {(!lead.history || lead.history.length === 0) && (
                <li className="text-sm text-muted-foreground">
                  Sem eventos ainda.
                </li>
              )}
            </ol>
          </CardContent>
        </Card>

        <footer className="text-center text-xs text-muted-foreground py-4">
          <Badge variant="outline" className="gap-1">
            <MapPin className="w-3 h-3" />
            Atualização automática
          </Badge>
        </footer>
      </div>
    </main>
  );
}

function humanizeEvent(eventType?: string | null): string {
  switch (eventType) {
    case "STATUS_CHANGE":
      return "Mudou de etapa";
    case "TRACKING_CHANGE":
      return "Mudou de setor";
    case "RESPONSIBLE_CHANGE":
      return "Novo responsável";
    case "FORM_SUBMITTED":
      return "Formulário recebido";
    case "FILE_UPLOADED":
      return "Arquivo enviado";
    case "SLA_BREACHED":
      return "Prazo excedido";
    case "PUBLIC_LINK_VIEWED":
      return "Você abriu o acompanhamento";
    default:
      return "Atualização registrada";
  }
}
