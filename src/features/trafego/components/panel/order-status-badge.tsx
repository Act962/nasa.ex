import type { TrafegoOrderStatus } from "@/generated/prisma/enums";
import {
  ORDER_CLIENT_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_STYLE,
} from "@/features/trafego/lib/order-status";
import { cn } from "@/lib/utils";

export function OrderStatusBadge({
  status,
  className,
  isClientView = false,
}: {
  status: TrafegoOrderStatus;
  className?: string;
  /** Painel do cliente: rótulo simples (spec 0126, D-3). */
  isClientView?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        ORDER_STATUS_STYLE[status],
        className,
      )}
    >
      {isClientView ? ORDER_CLIENT_STATUS_LABEL[status] : ORDER_STATUS_LABEL[status]}
    </span>
  );
}
