"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  CheckCircle2,
  ExternalLink,
  QrCode,
  TriangleAlert,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import {
  OBJECTIVE_LABEL,
  PLATFORM_SHORT_LABEL,
} from "@/features/trafego/lib/catalog-labels";
import { ORDER_STATUS_LABEL } from "@/features/trafego/lib/order-status";
import { useTrafegoLeadSummary } from "@/features/trafego/hooks/use-trafego-ops";
import { ConfirmPixDialog } from "./confirm-pix-dialog";

/**
 * Aba "trafeGO" do card do lead: onde a equipe confirma o PIX olhando o
 * comprovante que chegou na conversa ao lado, sem trocar de tela.
 */
export function LeadTrafegoTab({ leadId }: { leadId: string }) {
  const { data, isLoading } = useTrafegoLeadSummary(leadId);
  const [confirming, setConfirming] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <OrbitaSpinner className="size-4" />
        Carregando…
      </div>
    );
  }

  if (!data) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Este lead não veio do trafeGO.
      </p>
    );
  }

  const pendingToConfirm = data.awaitingPix.find((pending) => pending.id === confirming);

  return (
    <div className="space-y-5 py-4">
      {data.awaitingPix.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold">Aguardando confirmação de PIX</h3>
          <div className="mt-2 space-y-2">
            {data.awaitingPix.map((pending) => {
              const isExpired =
                pending.pixExpiresAt && new Date(pending.pixExpiresAt) < new Date();
              return (
                <div
                  key={pending.id}
                  className="rounded-[18px] border border-warning/30 bg-warning/15 p-3.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <QrCode className="size-4 shrink-0 text-warning" />
                        {formatBrlFromCents(pending.amountBrlCents)}
                        <span className="font-mono text-xs font-normal text-muted-foreground">
                          {pending.pixReference ?? "sem referência"}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Verba {formatBrlFromCents(pending.adBudgetBrlCents)} ·{" "}
                        {new Date(pending.createdAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {isExpired && (
                          <span className="ml-1.5 text-warning">
                            · vencida, mas ainda confirmável
                          </span>
                        )}
                      </p>
                    </div>

                    <Button size="sm" onClick={() => setConfirming(pending.id)}>
                      Confirmar PIX
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            Confirme só depois de ver o comprovante na conversa. A confirmação libera o
            acesso do cliente e lança a venda no financeiro.
          </p>
        </section>
      )}

      {data.orders.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold">Pedidos</h3>
          <div className="mt-2 space-y-2">
            {data.orders.map((order) => (
              <div key={order.id} className="rounded-[18px] border p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <span className="font-mono text-xs text-muted-foreground">
                        {order.code}
                      </span>
                      {ORDER_STATUS_LABEL[order.status]}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {PLATFORM_SHORT_LABEL[order.platform]} ·{" "}
                      {OBJECTIVE_LABEL[order.objective]} ·{" "}
                      {formatBrlFromCents(order.totalBrlCents)} ·{" "}
                      {order.paymentMethod === "PIX" ? "PIX" : "Cartão"}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <CheckBadge
                        isOk={Boolean(order.phoneVerifiedAt)}
                        label={
                          order.phoneVerifiedAt
                            ? "WhatsApp verificado"
                            : "WhatsApp não verificado"
                        }
                      />
                      {order.socialHandle && (
                        <CheckBadge isOk label={`Conta: ${order.socialHandle}`} />
                      )}
                      {order.officialNumber && (
                        <CheckBadge isOk label={`Número oficial: ${order.officialNumber}`} />
                      )}
                    </div>
                  </div>

                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/trafego/${order.id}`} target="_blank">
                      <ExternalLink className="mr-1.5 size-3.5" />
                      Abrir pedido
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.awaitingPix.length === 0 && data.orders.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Compra registrada, mas ainda sem pedido nem PIX pendente.
        </p>
      )}

      {pendingToConfirm && (
        <ConfirmPixDialog
          open
          onOpenChange={(open) => !open && setConfirming(null)}
          pending={pendingToConfirm}
          leadId={leadId}
        />
      )}
    </div>
  );
}

function CheckBadge({ isOk, label }: { isOk: boolean; label: string }) {
  return (
    <span
      className={
        isOk
          ? "inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-success"
          : "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
      }
    >
      {isOk ? <CheckCircle2 className="size-3" /> : <BadgeCheck className="size-3" />}
      {label}
    </span>
  );
}
