import type { TrafegoOrderStatus } from "@/generated/prisma/enums";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_STYLE,
} from "@/features/trafego/lib/order-status";
import { cn } from "@/lib/utils";

export function OrderStatusBadge({
  status,
  className,
}: {
  status: TrafegoOrderStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        ORDER_STATUS_STYLE[status],
        className,
      )}
    >
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}
