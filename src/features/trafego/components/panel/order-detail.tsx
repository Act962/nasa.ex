"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useActivateTrafegoOrder,
  useTrafegoOrder,
} from "@/features/trafego/hooks/use-trafego-orders";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import {
  CAMPAIGN_TYPE_SHORT_LABEL,
  OBJECTIVE_LABEL,
  PLATFORM_SHORT_LABEL,
} from "@/features/trafego/lib/catalog-labels";
import { isOrderActivatable, isOrderEditable } from "@/features/trafego/lib/order-status";
import { OrderStatusBadge } from "./order-status-badge";
import { StatusTimeline } from "./status-timeline";
import { CreativesManager } from "./creatives-manager";
import { CopiesManager } from "./copies-manager";
import { BriefingForm } from "./briefing-form";
import { PerformanceView } from "./performance-view";
import { SupportThread } from "./support-thread";

export function TrafegoOrderDetail({ orderId }: { orderId: string }) {
  const [tab, setTab] = useState("materiais");
  const { data: order, isLoading } = useTrafegoOrder(orderId);
  const activateOrder = useActivateTrafegoOrder();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Carregando campanha…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="px-4 py-20 text-center text-sm text-muted-foreground">
        Campanha não encontrada.
      </div>
    );
  }

  const readOnly = !isOrderEditable(order.status);
  const selectedCopies = order.copies.filter((copy) => copy.isSelected).length;
  const hasDestination = Boolean(order.destinationUrl || order.whatsappNumber);
  const canActivate =
    isOrderActivatable(order.status) &&
    order.creatives.length > 0 &&
    selectedCopies > 0 &&
    hasDestination;

  const pendingReasons = [
    order.creatives.length === 0 && "envie pelo menos um criativo",
    selectedCopies === 0 && "selecione pelo menos uma copy",
    !hasDestination && "informe o site de destino ou o WhatsApp",
  ].filter(Boolean) as string[];

  function handleActivate() {
    activateOrder.mutate(
      { orderId },
      {
        onSuccess: (result) => {
          toast.success(
            result.alreadyRequested
              ? "Esta campanha já estava com a equipe."
              : "Campanha enviada! Nossa equipe assume a partir daqui 🚀",
          );
          setTab("andamento");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <Link
        href="/trafego/painel"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Minhas campanhas
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {order.code}
            </span>
            <OrderStatusBadge status={order.status} />
          </div>
          <h1 className="mt-1.5 text-xl font-semibold">{order.planNameSnapshot}</h1>
          <p className="text-sm text-muted-foreground">
            {PLATFORM_SHORT_LABEL[order.platform]} ·{" "}
            {CAMPAIGN_TYPE_SHORT_LABEL[order.campaignType]} ·{" "}
            {OBJECTIVE_LABEL[order.objective]} · {order.durationDays} dias
          </p>
        </div>

        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums">
            {formatBrlFromCents(order.totalBrlCents)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatBrlFromCents(order.adBudgetBrlCents)} de verba +{" "}
            {formatBrlFromCents(order.serviceFeeBrlCents)} de serviço
          </p>
        </div>
      </div>

      {isOrderActivatable(order.status) && (
        <div className="mt-5 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {canActivate
                  ? "Tudo pronto para a equipe assumir"
                  : "Falta pouco para ativar"}
              </p>
              <p className="text-xs text-muted-foreground">
                {canActivate
                  ? "Ao ativar, sua campanha entra na fila da nossa equipe."
                  : `Para ativar: ${pendingReasons.join(", ")}.`}
              </p>
            </div>
            <Button
              type="button"
              onClick={handleActivate}
              disabled={!canActivate || activateOrder.isPending}
            >
              {activateOrder.isPending ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Rocket className="mr-1.5 size-4" />
              )}
              Ativar campanha
            </Button>
          </div>
        </div>
      )}

      {order.status === "REQUESTED" && (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-violet-500" />
          <div>
            <p className="text-sm font-medium">Recebemos sua campanha</p>
            <p className="text-xs text-muted-foreground">
              Nossa equipe está revisando os materiais. Você é avisado por aqui a cada
              mudança.
            </p>
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="materiais">Materiais</TabsTrigger>
          <TabsTrigger value="andamento">Andamento</TabsTrigger>
          <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
          <TabsTrigger value="suporte">Suporte</TabsTrigger>
        </TabsList>

        <TabsContent value="materiais" className="mt-6 space-y-8">
          <CreativesManager
            orderId={order.id}
            creatives={order.creatives}
            maxCreatives={order.maxCreatives}
            readOnly={readOnly}
          />
          <CopiesManager
            orderId={order.id}
            copies={order.copies}
            maxCopies={order.maxCopies}
            readOnly={readOnly}
          />
          <BriefingForm
            orderId={order.id}
            readOnly={readOnly}
            initial={{
              businessName: order.businessName,
              businessNiche: order.businessNiche,
              targetAudience: order.targetAudience,
              destinationUrl: order.destinationUrl,
              whatsappNumber: order.whatsappNumber,
              notes: order.notes,
            }}
          />
        </TabsContent>

        <TabsContent value="andamento" className="mt-6">
          <StatusTimeline status={order.status} events={order.events} />
        </TabsContent>

        <TabsContent value="desempenho" className="mt-6">
          <PerformanceView orderId={order.id} />
        </TabsContent>

        <TabsContent value="suporte" className="mt-6">
          <SupportThread orderId={order.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
