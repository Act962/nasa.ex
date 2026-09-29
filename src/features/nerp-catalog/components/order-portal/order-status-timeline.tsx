import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATALOG_STAGES, catalogStageIndex, type CatalogStageKey } from "../../lib/catalog-stages";

type OrderStatus =
  | "RECEIVED"
  | "NEGOTIATING"
  | "AWAITING_PAYMENT"
  | "PAID"
  | "IN_LOGISTICS"
  | "DELIVERED"
  | "CANCELED";

const TIMELINE_STEPS: { label: string; reachedBy: OrderStatus[] }[] = [
  { label: "Pedido recebido", reachedBy: ["RECEIVED", "NEGOTIATING", "AWAITING_PAYMENT", "PAID", "IN_LOGISTICS", "DELIVERED"] },
  { label: "Confirmação", reachedBy: ["NEGOTIATING", "AWAITING_PAYMENT", "PAID", "IN_LOGISTICS", "DELIVERED"] },
  { label: "Pagamento", reachedBy: ["PAID", "IN_LOGISTICS", "DELIVERED"] },
  { label: "Separação e entrega", reachedBy: ["IN_LOGISTICS", "DELIVERED"] },
  { label: "Entregue", reachedBy: ["DELIVERED"] },
];

// Tracking com as etapas padrão (spec 0044): a coluna do lead é a etapa atual.
function StageTimeline({ stageKey }: { stageKey: CatalogStageKey }) {
  const currentIndex = catalogStageIndex(stageKey);
  return (
    <ol className="flex flex-col gap-3">
      {CATALOG_STAGES.map((stage, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li key={stage.key} className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs transition-colors",
                isDone && "border-primary bg-primary text-primary-foreground",
                isCurrent && "border-primary text-primary ring-4 ring-primary/20",
                !isDone && !isCurrent && "border-muted-foreground/30 text-muted-foreground",
              )}
            >
              {isDone ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span className={cn("text-sm", isCurrent ? "font-semibold text-primary" : isDone ? "" : "text-muted-foreground")}>
              {stage.name}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderStatusTimeline({
  status,
  logisticsStage,
  stageKey,
}: {
  status: OrderStatus;
  logisticsStage: string | null;
  stageKey?: CatalogStageKey | null;
}) {
  if (status === "CANCELED") {
    return <p className="text-sm font-medium text-destructive">Pedido cancelado.</p>;
  }
  if (stageKey) return <StageTimeline stageKey={stageKey} />;

  return (
    <ol className="flex flex-col gap-3">
      {TIMELINE_STEPS.map((step, index) => {
        const isReached = step.reachedBy.includes(status);
        const nextStep = TIMELINE_STEPS[index + 1];
        const isCurrent = isReached && (!nextStep || !nextStep.reachedBy.includes(status));
        return (
          <li key={step.label} className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                isReached ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-muted-foreground",
              )}
            >
              {isReached ? <Check className="size-3.5" /> : index + 1}
            </span>
            <div className="flex flex-col">
              <span className={cn("text-sm", isCurrent ? "font-semibold" : isReached ? "" : "text-muted-foreground")}>
                {step.label}
              </span>
              {isCurrent && status === "IN_LOGISTICS" && logisticsStage && (
                <span className="text-xs text-muted-foreground">Agora: {logisticsStage}</span>
              )}
              {isCurrent && status === "AWAITING_PAYMENT" && (
                <span className="text-xs text-muted-foreground">Aguardando confirmação do pagamento</span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
