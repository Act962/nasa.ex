"use client";

import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** Gaveta de baixo do menu rápido: título com ícone, descrição curta e conteúdo rolável. */
export function QuickMenuSheet({
  open,
  onOpenChange,
  icon,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[88dvh] flex-col gap-3 rounded-t-[26px] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mt-1 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" />
        <SheetHeader className="p-0 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <span className="grid size-8 place-items-center rounded-full bg-muted [&_svg]:size-4">{icon}</span>
            {title}
          </SheetTitle>
          <SheetDescription className="text-xs">{description}</SheetDescription>
        </SheetHeader>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">{children}</div>
        {footer}
      </SheetContent>
    </Sheet>
  );
}

export function QuickMenuEmpty({ children }: { children: ReactNode }) {
  return <p className="rounded-[18px] border border-dashed border-line p-6 text-center text-sm text-muted-foreground">{children}</p>;
}
