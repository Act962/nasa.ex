"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Send, X } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import {
  useCancelTrafegoComplement,
  useSendTrafegoComplement,
  useSetTrafegoOutsideCampaigns,
  useTrafegoComplements,
} from "@/features/trafego/hooks/use-trafego-admin";
import { SettingsNotice } from "./settings/settings-primitives";

/** Cartão "Complementos" do pedido (spec 0123, RF-13): rascunhos para enviar e campanhas fora da base. */

function formatCalendarDate(isoDate: string): string {
  return isoDate.split("-").reverse().join("/");
}

function complementBadge(complement: { status: string; isSent: boolean; isOverdue: boolean }) {
  if (complement.status === "CANCELLED") return { label: "Cancelado", variant: "outline" as const };
  if (complement.status === "PAID") return { label: "Pago", variant: "secondary" as const };
  if (complement.isOverdue) return { label: "Vencido", variant: "destructive" as const };
  if (!complement.isSent) return { label: "Rascunho", variant: "outline" as const };
  return { label: complement.status === "PARTIAL" ? "Pago em parte" : "Enviado", variant: "secondary" as const };
}

export function ComplementsCard({ orderId }: { orderId: string }) {
  const { data, isLoading } = useTrafegoComplements(orderId);
  const sendComplement = useSendTrafegoComplement();
  const cancelComplement = useCancelTrafegoComplement();
  const [isEditingOutside, setIsEditingOutside] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  if (isLoading) {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-semibold">Complementos</h3>
        <OrbitaSpinner className="mt-3 size-4" />
      </div>
    );
  }
  if (!data?.isApplicable) return null;

  const { reading } = data;

  function handleSend(entryId: string) {
    sendComplement.mutate(
      { orderId, entryId },
      {
        onSuccess: ({ ruleName }) => toast.success(`Cobrança enviada pela régua "${ruleName}".`),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function handleCancel(entryId: string, documentNumber: string) {
    cancelComplement.mutate(
      { orderId, entryId, reason: cancelReason },
      {
        onSuccess: () => {
          toast.success(`${documentNumber} cancelado.`);
          setCancellingId(null);
          setCancelReason("");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Complementos</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        30% sobre o gasto real da conta no período, descontado o que já foi cobrado. Nasce como rascunho.
      </p>

      {reading.status === "ok" && (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Gasto real</dt>
          <dd className="text-right font-medium">{formatBrlFromCents(reading.spentBrlCents)}</dd>
          <dt className="text-muted-foreground">Taxa devida</dt>
          <dd className="text-right font-medium">{formatBrlFromCents(reading.dueFeeBrlCents)}</dd>
          <dt className="text-muted-foreground">Já cobrado</dt>
          <dd className="text-right font-medium">{formatBrlFromCents(reading.chargedBrlCents)}</dd>
          <dt className="col-span-2 mt-1 text-[11px] text-muted-foreground">
            {formatCalendarDate(reading.since)} a {formatCalendarDate(reading.until)}
            {reading.pendingComplementBrlCents > 0 &&
              ` · o cálculo de hoje à noite gera ${formatBrlFromCents(reading.pendingComplementBrlCents)}`}
            {reading.isTruncated && " · leitura parcial da Meta"}
          </dt>
        </dl>
      )}
      {reading.status === "unavailable" && (
        <div className="mt-3">
          <SettingsNotice tone="warn">{reading.message}</SettingsNotice>
        </div>
      )}

      {data.complements.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {data.complements.map((complement) => {
            const badge = complementBadge(complement);
            const isOpen = !["PAID", "CANCELLED"].includes(complement.status);
            return (
              <li key={complement.id} className="rounded-md border p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">{complement.documentNumber}</span>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {formatBrlFromCents(complement.amountBrlCents)} · vence {formatCalendarDate(complement.dueDate)}
                </p>
                {isOpen && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {!complement.isSent && (
                      <Button
                        size="sm"
                        className="h-7"
                        disabled={sendComplement.isPending}
                        onClick={() => handleSend(complement.id)}
                      >
                        <Send className="mr-1 size-3" />
                        Enviar cobrança
                      </Button>
                    )}
                    {complement.chargeUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => {
                          void navigator.clipboard.writeText(complement.chargeUrl ?? "");
                          toast.success("Link da cobrança copiado.");
                        }}
                      >
                        <Copy className="mr-1 size-3" />
                        Link
                      </Button>
                    )}
                    {complement.paidBrlCents === 0 && cancellingId !== complement.id && (
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => setCancellingId(complement.id)}>
                        <X className="mr-1 size-3" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                )}
                {cancellingId === complement.id && (
                  <div className="mt-2 space-y-1.5">
                    <Input
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      placeholder="Motivo do cancelamento"
                      className="h-8 text-xs"
                    />
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7"
                        disabled={cancelComplement.isPending || cancelReason.trim().length < 3}
                        onClick={() => handleCancel(complement.id, complement.documentNumber)}
                      >
                        Confirmar cancelamento
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => setCancellingId(null)}>
                        Voltar
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Nenhum complemento até agora.</p>
      )}

      {reading.status === "ok" && reading.campaigns.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium">Campanhas fora do trafeGO</p>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setIsEditingOutside((isOn) => !isOn)}>
              {isEditingOutside ? "Fechar" : "Escolher"}
            </Button>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {data.outsideCampaignIds.length > 0
              ? `${data.outsideCampaignIds.length} campanha(s) fora da base do complemento.`
              : "Todas as campanhas da conta contam."}
          </p>
          {isEditingOutside && (
            <OutsideCampaignsPicker
              orderId={orderId}
              campaigns={reading.campaigns}
              initialIds={data.outsideCampaignIds}
              onSaved={() => setIsEditingOutside(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function OutsideCampaignsPicker({
  orderId,
  campaigns,
  initialIds,
  onSaved,
}: {
  orderId: string;
  campaigns: { id: string; name: string; spendBrlCents: number }[];
  initialIds: string[];
  onSaved: () => void;
}) {
  const setOutsideCampaigns = useSetTrafegoOutsideCampaigns();
  const [selectedIds, setSelectedIds] = useState(() => new Set(initialIds));

  function toggle(campaignId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });
  }

  return (
    <div className="mt-2 space-y-1.5">
      {campaigns.map((campaign) => (
        <label key={campaign.id} className="flex cursor-pointer items-start gap-2 text-xs">
          <Checkbox
            checked={selectedIds.has(campaign.id)}
            onCheckedChange={() => toggle(campaign.id)}
            className="mt-0.5"
          />
          <span className="min-w-0 flex-1 break-words">{campaign.name}</span>
          <span className="shrink-0 text-muted-foreground">{formatBrlFromCents(campaign.spendBrlCents)}</span>
        </label>
      ))}
      <Button
        size="sm"
        className="mt-2 w-full"
        disabled={setOutsideCampaigns.isPending}
        onClick={() =>
          setOutsideCampaigns.mutate(
            { orderId, campaignIds: [...selectedIds] },
            {
              onSuccess: () => {
                toast.success("Campanhas fora do trafeGO salvas.");
                onSaved();
              },
              onError: (error) => toast.error(error.message),
            },
          )
        }
      >
        Salvar
      </Button>
    </div>
  );
}
