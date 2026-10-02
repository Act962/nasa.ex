"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer group/switch relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-transparent outline-none transition-all before:absolute before:inset-x-1 before:top-1/2 before:h-[3px] before:-translate-y-1/2 before:rounded-full before:bg-line before:transition-colors data-[state=checked]:before:bg-info/45 focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "relative z-10 pointer-events-none block size-5 rounded-full bg-knob shadow-xs ring-0 transition-[transform,background-color] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] data-[state=checked]:bg-info data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
