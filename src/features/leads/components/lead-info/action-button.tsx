"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VariantProps } from "class-variance-authority";
import { ReactNode, forwardRef, ComponentProps } from "react";

interface ActionButtonProps
  extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  icon: ReactNode;
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ icon, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        size="icon-xs"
        variant="secondary"
        className={cn(
          "rounded-full bg-secondary/50 hover:bg-secondary h-8 w-8 transition-all hover:scale-105",
          className,
        )}
        {...props}
      >
        {icon}
      </Button>
    );
  },
);

ActionButton.displayName = "ActionButton";
