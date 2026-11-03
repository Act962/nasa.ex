"use client";

import type { TrafegoOrderStatus } from "@/generated/prisma/enums";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusTimeline } from "./status-timeline";
import { ReleaseEditor } from "./release-editor";
import { BriefingForm } from "./briefing-form";
import { SupportThread } from "./support-thread";
import { AccountPerformanceView } from "./account-performance-view";
import { CampaignBuilderView } from "./campaign-builder/campaign-builder-view";

/** O que saiu das abas e é consulta rara mora numa gaveta (spec 0126, RF-5/RF-6). */

export type OrderPanelSection = "publicar" | "numeros" | "andamento" | "empresa" | "suporte";

export const ORDER_PANEL_SECTION: Record<OrderPanelSection, { title: string; description: string }> = {
  publicar: { title: "Publicar e editar", description: "Monte o anúncio de WhatsApp ou ajuste a campanha no ar." },
  numeros: { title: "Mais números da conta", description: "Gasto por dia, todas as campanhas e públicos." },
  andamento: { title: "Andamento", description: "Em que fase a campanha está." },
  empresa: { title: "Sobre a empresa", description: "O Astro usa isto para avaliar o criativo e sugerir textos." },
  suporte: { title: "Suporte", description: "Converse com a nossa equipe." },
};

type BriefingInitial = Parameters<typeof BriefingForm>[0]["initial"];

export function OrderPanelSheet({
  section,
  onClose,
  order,
  isReadOnly,
}: {
  section: OrderPanelSection | null;
  onClose: () => void;
  order: {
    id: string;
    code: string;
    status: TrafegoOrderStatus;
    durationDays: number;
    events: Parameters<typeof StatusTimeline>[0]["events"];
    briefing: BriefingInitial;
  };
  isReadOnly: boolean;
}) {
  const meta = section ? ORDER_PANEL_SECTION[section] : null;

  return (
    <Sheet open={section !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        {meta && (
          <SheetHeader>
            <SheetTitle>{meta.title}</SheetTitle>
            <SheetDescription>{meta.description}</SheetDescription>
          </SheetHeader>
        )}
        <div className="space-y-6 px-4 pb-6">
          {section === "publicar" && <CampaignBuilderView orderId={order.id} durationDays={order.durationDays} />}
          {section === "numeros" && <AccountPerformanceView orderId={order.id} orderCode={order.code} />}
          {section === "andamento" && <StatusTimeline status={order.status} events={order.events} />}
          {section === "empresa" && (
            <>
              <BriefingForm orderId={order.id} readOnly={isReadOnly} initial={order.briefing} />
              <ReleaseEditor orderId={order.id} />
            </>
          )}
          {section === "suporte" && <SupportThread orderId={order.id} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
