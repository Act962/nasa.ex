"use client";

import { useState } from "react";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { toast } from "sonner";
import { Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryTracking } from "@/features/tracking-settings/hooks/use-tracking";
import { useStatus } from "@/features/status/hooks/use-status";
import { useErpCarteiraStatus, useStartErpCarteiraImport } from "../hooks/use-erp-carteira";

// Spec 0106 (RF-3): importar a carteira de clientes do Winthor como leads, com tags e histórico.

type ImportReport = {
  read?: number;
  created?: number;
  updated?: number;
  skippedNoContact?: number;
  failed?: number;
  purchasesAdded?: number;
};

const STATUS_LABEL: Record<string, string> = {
  queued: "Na fila",
  running: "Importando",
  done: "Concluída",
  failed: "Parou no meio",
  idle: "Não iniciada",
};

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function ErpCarteiraCard() {
  const statusQuery = useErpCarteiraStatus();
  const startImport = useStartErpCarteiraImport();
  const trackings = useQueryTracking();
  const record = statusQuery.data?.record ?? null;
  // `null` = ainda não mexeu: vale o destino salvo da última importação.
  const [pickedTrackingId, setTrackingId] = useState<string | null>(null);
  const [pickedStatusId, setStatusId] = useState<string | null>(null);
  const trackingId = pickedTrackingId ?? record?.trackingId ?? "";
  const statusId = pickedStatusId ?? (pickedTrackingId ? "" : (record?.statusId ?? ""));
  const statuses = useStatus(trackingId);

  if (!statusQuery.data?.canImport) return null;

  const report = (record?.report ?? null) as ImportReport | null;
  const isBusy = !!statusQuery.data?.isInProgress;
  // Carga completa que parou no meio (falhou ou travou): o botão continua de onde parou.
  const isResuming = !isBusy && record?.mode === "full" && record.status !== "done" && record.status !== "idle";

  const handleImport = () => {
    startImport.mutate(
      { trackingId, statusId },
      {
        onSuccess: () =>
          toast.success("Importação iniciada. Nenhuma mensagem é enviada aos clientes."),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Card id="carteira-erp">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Database className="size-5 text-primary" />
            Carteira de clientes do Winthor
          </CardTitle>
          {record && (
            <Badge variant={record.status === "failed" ? "destructive" : "secondary"}>
              {isResuming && record.status !== "failed" ? "Parou no meio" : (STATUS_LABEL[record.status] ?? record.status)}
            </Badge>
          )}
        </div>
        <CardDescription>
          Cada cliente que já comprou vira lead, com as tags de filial, situação (Inadimplente ou Em dia),
          tempo sem comprar e interesses, e as compras na Jornada. Depois da primeira carga, atualiza sozinho
          todo dia depois da sincronização do Winthor. Importar não envia mensagem nem dispara fluxo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium">Funil de destino</label>
            <Select
              value={trackingId}
              onValueChange={(value) => {
                setTrackingId(value);
                setStatusId("");
              }}
              disabled={isBusy}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o funil" />
              </SelectTrigger>
              <SelectContent>
                {trackings.trackings?.map((tracking) => (
                  <SelectItem key={tracking.id} value={tracking.id}>
                    {tracking.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium">Etapa inicial</label>
            <Select value={statusId} onValueChange={setStatusId} disabled={!trackingId || isBusy}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={trackingId ? "Selecione a etapa" : "Escolha o funil antes"} />
              </SelectTrigger>
              <SelectContent>
                {statuses.status.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {report && (
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <div className="text-muted-foreground text-xs">Lidos</div>
              <div className="font-semibold">{report.read ?? 0}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Leads novos</div>
              <div className="font-semibold">{report.created ?? 0}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Atualizados</div>
              <div className="font-semibold">{report.updated ?? 0}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Sem telefone e documento</div>
              <div className="font-semibold">{report.skippedNoContact ?? 0}</div>
            </div>
          </div>
        )}

        {record?.error && <p className="text-destructive text-sm">{record.error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            Carga completa: {formatDateTime(record?.lastFullAt)} · Última atualização:{" "}
            {formatDateTime(record?.lastRefreshAt)}
          </p>
          <Button
            data-guide={GUIDE_ANCHORS.erpCarteiraImportButton.id}
            onClick={handleImport}
            disabled={!trackingId || !statusId || isBusy || startImport.isPending}
          >
            {isBusy ? "Importando…" : isResuming ? "Continuar importação" : "Importar carteira"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
