"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CopyValueFieldProps {
  value: string | null | undefined;
  isLoading: boolean;
  loadingLabel: string;
  copiedMessage: string;
  isCentered?: boolean;
}

/** Valor só de leitura (ID, link) com botão de copiar. */
export function CopyValueField({
  value,
  isLoading,
  loadingLabel,
  copiedMessage,
  isCentered = false,
}: CopyValueFieldProps) {
  const copyValue = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast.success(copiedMessage);
  };

  return (
    <div className="flex h-11 w-full items-center gap-2 rounded-full border border-info/30 bg-info/5 pr-1 pl-4">
      {isLoading ? (
        <span className="flex-1 animate-pulse text-center text-xs text-muted-foreground">
          {loadingLabel}
        </span>
      ) : (
        <>
          <code
            className={cn(
              "min-w-0 flex-1 truncate font-mono text-xs font-semibold text-info select-all",
              isCentered && "text-center",
            )}
          >
            {value ?? "—"}
          </code>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Copiar"
              className="size-9 shrink-0 rounded-full text-info hover:bg-info/10 hover:text-info"
              onClick={copyValue}
            >
              <CopyIcon className="size-4" />
            </Button>
          )}
        </>
      )}
    </div>
  );
}
