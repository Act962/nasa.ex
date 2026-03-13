"use client";

import { useState } from "react";
import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";

import { cn } from "@/lib/utils";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Switch } from "@/components/ui/switch-variable";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HeaderProps extends React.ComponentProps<
  typeof SwitchPrimitive.Root
> {
  leadId: string;
  trackingId: string;
  active: boolean;
  className?: string;
  size: "default" | "xs" | "sm" | "lg" | null | undefined;
}
export function CheckIaLead({
  leadId,
  active: initialActive,
  trackingId,
  className,
  size = "default",
  ...props
}: HeaderProps) {
  const [active, setActive] = useState(initialActive);
  const mutationLeadUpdate = useMutationLeadUpdate(leadId, trackingId);

  const onActiveChange = (checked: boolean) => {
    setActive(checked);
    mutationLeadUpdate.mutate({
      id: leadId,
      active: checked,
    });
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Switch
              size={size}
              {...props}
              name="active"
              checked={active}
              onCheckedChange={onActiveChange}
              className={cn(className)}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>{active ? "Desativar IA" : "Ativar IA"}</TooltipContent>
      </Tooltip>
    </>
  );
}
