"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Dialog centralizado no computador e gaveta de baixo no celular: só o miolo rola, a ação fica fixa embaixo. */

interface LinnkerSheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon?: ReactNode;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function LinnkerSheetDialog({
  open,
  onOpenChange,
  title,
  icon,
  description,
  children,
  footer,
  className,
  bodyClassName,
}: LinnkerSheetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-[24px] p-0 sm:max-w-lg",
          "max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[26px] max-sm:border-x-0 max-sm:border-b-0",
          "max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom",
          className,
        )}
      >
        <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted sm:hidden" />
        <DialogHeader className="shrink-0 px-4 pt-3 pb-3 text-left sm:px-6 sm:pt-5">
          <DialogTitle className="flex items-center gap-2 pr-10 text-base font-semibold">
            {icon}
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-xs">{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-6", bodyClassName)}>
          {children}
        </div>
        {footer ? (
          <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-line bg-popover px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:py-4">
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
