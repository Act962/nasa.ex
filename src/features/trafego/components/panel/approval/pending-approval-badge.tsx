import { AlertTriangle } from "lucide-react";

/** Selo "Precisa de aprovação" do cartão e do detalhe (spec 0130, RF-8). */
export function PendingApprovalBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
      <AlertTriangle className="size-3.5" />
      Precisa de aprovação
    </span>
  );
}
