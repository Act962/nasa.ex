"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCreatePaymentEntry } from "../../hooks/use-payment";
import { EntryForm } from "../entries/entry-form";

type EntryType = "RECEIVABLE" | "PAYABLE";

const TYPE_OPTIONS: {
  value: EntryType;
  label: string;
  icon: React.ElementType;
  activeClass: string;
}[] = [
  {
    value: "RECEIVABLE",
    label: "Receita",
    icon: ArrowDownLeft,
    activeClass:
      "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    value: "PAYABLE",
    label: "Despesa",
    icon: ArrowUpRight,
    activeClass:
      "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400",
  },
];

export function NewTransactionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [type, setType] = useState<EntryType>("PAYABLE");
  const createEntry = useCreatePaymentEntry();

  // O diálogo fica montado entre aberturas — sem isso ele reabriria no último
  // tipo escolhido em vez do default.
  useEffect(() => {
    if (open) setType("PAYABLE");
  }, [open]);

  async function handleSubmit(
    payload: Parameters<typeof createEntry.mutateAsync>[0],
  ) {
    try {
      await createEntry.mutateAsync(payload);
      onOpenChange(false);
      toast.success(
        type === "RECEIVABLE" ? "Receita criada!" : "Despesa criada!",
      );
    } catch {
      toast.error("Erro ao criar lançamento");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto scroll-cols-tracking">
        <DialogHeader>
          <DialogTitle>Nova transação</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {TYPE_OPTIONS.map((option) => {
            const isActive = type === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? option.activeClass
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <option.icon className="size-4" />
                {option.label}
              </button>
            );
          })}
        </div>

        <EntryForm
          key={type}
          type={type}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isLoading={createEntry.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
