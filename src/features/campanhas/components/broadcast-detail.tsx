"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBroadcast } from "../hooks/use-broadcasts";
import { BROADCAST_STATUS_LABEL } from "../lib/broadcast-status";
import { LeadsAudienceTab } from "./audience-builder/leads-tab";
import { CsvAudienceTab } from "./audience-builder/csv-tab";
import { RecipientsTable } from "./recipients-table";

function CounterCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function BroadcastDetail({ broadcastId }: { broadcastId: string }) {
  const { data: broadcast, isLoading } = useBroadcast(broadcastId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!broadcast) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
        Campanha não encontrada.{" "}
        <Link href="/campanhas" className="underline">
          Voltar
        </Link>
      </div>
    );
  }

  const number =
    broadcast.tracking.whatsappInstance?.phoneNumber ??
    broadcast.tracking.name;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
      <Link
        href="/campanhas"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Campanhas
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{broadcast.name}</h1>
            <Badge variant="secondary">
              {BROADCAST_STATUS_LABEL[broadcast.status] ?? broadcast.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Origem: {number}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <CounterCard label="Destinatários" value={broadcast.totalRecipients} />
        <CounterCard label="Enviados" value={broadcast.sentCount} />
        <CounterCard label="Entregues" value={broadcast.deliveredCount} />
        <CounterCard label="Lidos" value={broadcast.readCount} />
        <CounterCard label="Falhas" value={broadcast.failedCount} />
      </div>

      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="csv">CSV / Planilha</TabsTrigger>
          <TabsTrigger value="recipients">
            Destinatários ({broadcast.totalRecipients})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="leads" className="pt-4">
          <LeadsAudienceTab broadcastId={broadcast.id} />
        </TabsContent>
        <TabsContent value="csv" className="pt-4">
          <CsvAudienceTab broadcastId={broadcast.id} />
        </TabsContent>
        <TabsContent value="recipients" className="pt-4">
          <RecipientsTable broadcastId={broadcast.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
