"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useLeadSeiProcesses,
  useLinkSeiProcess,
  useRequestSeiSync,
  useUnlinkSeiProcess,
} from "@/features/sei/hooks/use-sei-processes";
import { AlertCircle, ExternalLink, FileSearch, Landmark, Link2, RefreshCw, Unlink } from "lucide-react";
import { useState, type FormEvent } from "react";

type Props = {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SeiLeadProcessDialog({ leadId, open, onOpenChange }: Props) {
  const [protocolo, setProtocolo] = useState("");
  const processesQuery = useLeadSeiProcesses(leadId, open);
  const linkProcess = useLinkSeiProcess(leadId);
  const syncProcess = useRequestSeiSync(leadId);
  const unlinkProcess = useUnlinkSeiProcess(leadId);

  function handleLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = protocolo.trim();
    if (!normalized) return;
    linkProcess.mutate(
      { leadId, protocolo: normalized },
      { onSuccess: ({ link }) => {
        setProtocolo("");
        syncProcess.mutate({ linkId: link.id });
      } },
    );
  }

  const processes = processesQuery.data?.processes ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark /> Processos SEI do lead
          </DialogTitle>
          <DialogDescription>
            Vincule processos conhecidos, sincronize o andamento e use os dados em automações e mensagens.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertCircle />
          <AlertTitle>SEI + Chat</AlertTitle>
          <AlertDescription>
            Em automações, adicione “Consultar processo SEI” antes de “Enviar mensagem” e use as variáveis exibidas no nó.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleLink}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="sei-protocolo">Número do processo</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="sei-protocolo"
                  value={protocolo}
                  onChange={(event) => setProtocolo(event.target.value)}
                  placeholder="00000.000000/2026-00"
                  autoComplete="off"
                />
                <Button type="submit" disabled={!protocolo.trim() || linkProcess.isPending}>
                  <Link2 data-icon="inline-start" /> Vincular
                </Button>
              </div>
              <FieldDescription>
                O número é validado na primeira sincronização com o WebService do órgão.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>

        {processesQuery.isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : processesQuery.isError ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Não foi possível carregar os processos</AlertTitle>
            <AlertDescription>{processesQuery.error.message}</AlertDescription>
          </Alert>
        ) : processes.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon"><FileSearch /></EmptyMedia>
              <EmptyTitle>Nenhum processo vinculado</EmptyTitle>
              <EmptyDescription>Informe acima um protocolo que já exista no SEI.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-3">
            {processes.map((process) => (
              <article key={process.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{process.protocoloProcedimento}</p>
                      <Badge variant={process.lastSyncedAt ? "secondary" : "outline"}>
                        {process.lastSyncedAt ? "Sincronizado" : "Aguardando consulta"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {process.especificacao ?? "Os detalhes aparecerão após a sincronização."}
                    </p>
                    {process.ultimoAndamento ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Último andamento: {process.ultimoAndamento}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {process.linkAcesso ? (
                      <Button variant="ghost" size="icon-sm" asChild title="Abrir no SEI">
                        <a href={process.linkAcesso} target="_blank" rel="noreferrer">
                          <ExternalLink />
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Sincronizar"
                      disabled={syncProcess.isPending}
                      onClick={() => syncProcess.mutate({ linkId: process.id })}
                    >
                      <RefreshCw />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Remover vínculo"
                      disabled={unlinkProcess.isPending}
                      onClick={() => unlinkProcess.mutate({ linkId: process.id })}
                    >
                      <Unlink />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
