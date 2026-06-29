"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const switchVariants = cva(
  "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        xs: "w-5 h-[0.75rem]",
        sm: "w-6 h-[1rem]",
        default: "w-8 h-[1.15rem]",
        lg: "w-11 h-[1.5rem]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

const thumbVariants = cva(
  "bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block rounded-full ring-0 transition-transform data-[state=unchecked]:translate-x-0",
  {
    variants: {
      size: {
        xs: "size-2.5 data-[state=checked]:translate-x-[calc(100%-1.5px)]",
        sm: "size-3 data-[state=checked]:translate-x-[calc(100%-2px)]",
        default: "size-4 data-[state=checked]:translate-x-[calc(100%-2px)]",
        lg: "size-5 data-[state=checked]:translate-x-[calc(100%-3px)]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

function Switch({
  className,
  size,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> &
  VariantProps<typeof switchVariants>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(switchVariants({ size }), className)}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(thumbVariants({ size }))}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
