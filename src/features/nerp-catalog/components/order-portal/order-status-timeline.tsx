import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function OrderStatusTimeline({
  status,
  logisticsStage,
}: {
  status: OrderStatus;
  logisticsStage: string | null;
}) {
  if (status === "CANCELED") {
    return <p className="text-sm font-medium text-destructive">Pedido cancelado.</p>;
  }

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
