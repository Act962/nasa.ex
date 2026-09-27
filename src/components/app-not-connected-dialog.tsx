"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Aviso genérico de "app não conectado" com atalho para a tela de conexão
 * (spec 0029, RF-13). Qualquer app que dependa de outro reusa este dialog.
 */
export function AppNotConnectedDialog({
  open,
  onOpenChange,
  icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          {icon && (
            <div className="mb-2 grid size-14 place-items-center rounded-2xl bg-muted">
              {icon}
            </div>
          )}
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-center">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
          <Button asChild>
            <Link href={actionHref} onClick={() => onOpenChange(false)}>
              {actionLabel}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
