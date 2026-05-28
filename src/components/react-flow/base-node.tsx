import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import { type NodeStatus } from "./node-status-indicator";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  Loader2Icon,
  XCircleIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type NodeValidation = {
  valid: boolean;
  /** Mensagens curtas pra mostrar no tooltip. Vazio quando valid=true. */
  errors: string[];
  /** Skip = sem validação aplicável (triggers estruturais). */
  skip?: boolean;
};

interface BaseNodeProps extends ComponentProps<"div"> {
  status?: NodeStatus;
  /** Resultado de `validateNode`. Quando provided, pinta borda + tooltip. */
  validation?: NodeValidation;
}

export function BaseNode({
  className,
  status,
  validation,
  ...props
}: BaseNodeProps) {
  // Borda colorida baseada na validação. Apenas se o node TEM validação
  // significativa (não-skip). Triggers estruturais como INITIAL ficam
  // sem cor — não confundem o user.
  const validationBorder =
    validation && !validation.skip
      ? validation.valid
        ? "border-emerald-500/70"
        : "border-red-500/80"
      : "";

  const innerNode = (
    <div
      className={cn(
        "bg-card text-card-foreground relative rounded-sm border border-muted-foreground hover:bg-accent p-1.5",
        "hover:ring-1",
        validationBorder,
        className,
      )}
      tabIndex={0}
      {...props}
    >
      {props.children}
      {status === "error" && (
        <XCircleIcon className="absolute right-0.5 bottom-0.5 size-2 text-red-700 stroke-3" />
      )}
      {status === "success" && (
        <CheckCircle2Icon className="absolute right-0.5 bottom-0.5 size-2 text-green-700 stroke-3" />
      )}
      {status === "loading" && (
        <Loader2Icon className="absolute -right-0.5 -bottom-0.5 size-2 text-blue-700 stroke-3 animate-spin" />
      )}
      {/* Indicador de validação no canto superior direito quando inválido —
          visível mesmo sem hover, pra usuário identificar rápido qual ação
          falta configurar. */}
      {validation && !validation.skip && !validation.valid && (
        <AlertTriangleIcon className="absolute -top-1 -right-1 size-3 text-red-600 fill-red-100" />
      )}
    </div>
  );

  // Se inválido, envolve com Tooltip listando erros. Hover no node mostra
  // exatamente o que falta preencher.
  if (validation && !validation.skip && !validation.valid) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>{innerNode}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-semibold mb-1 text-xs">
              Ação com campos faltando:
            </p>
            <ul className="text-[11px] space-y-0.5 list-disc list-inside">
              {validation.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return innerNode;
}

/**
 * A container for a consistent header layout intended to be used inside the
 * `<BaseNode />` component.
 */
export function BaseNodeHeader({
  className,
  ...props
}: ComponentProps<"header">) {
  return (
    <header
      {...props}
      className={cn(
        "mx-0 my-0 -mb-1 flex flex-row items-center justify-between gap-2 px-3 py-2",
        // Remove or modify these classes if you modify the padding in the
        // `<BaseNode />` component.
        className,
      )}
    />
  );
}

/**
 * The title text for the node. To maintain a native application feel, the title
 * text is not selectable.
 */
export function BaseNodeHeaderTitle({
  className,
  ...props
}: ComponentProps<"h3">) {
  return (
    <h3
      data-slot="base-node-title"
      className={cn("user-select-none flex-1 font-semibold", className)}
      {...props}
    />
  );
}

export function BaseNodeContent({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="base-node-content"
      className={cn("flex flex-col gap-y-2 p-3", className)}
      {...props}
    />
  );
}

export function BaseNodeFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="base-node-footer"
      className={cn(
        "flex flex-col items-center gap-y-2 border-t px-3 pt-2 pb-3",
        className,
      )}
      {...props}
    />
  );
}
