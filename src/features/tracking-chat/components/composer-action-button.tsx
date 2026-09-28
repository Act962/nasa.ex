"use client";

/**
 * Botão de ação do composer do chat (anexar, emojis, áudio, enviar).
 * Alvo visual é o composer do WhatsApp: alvo circular de 36px, ícone de
 * 20px, fundo aparecendo só no hover e tooltip acima.
 */

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ComposerActionButtonProps extends React.ComponentProps<"button"> {
  /** Texto do tooltip — vira também o `aria-label` do botão. */
  label: string;
}

export function ComposerActionButton({
  label,
  className,
  children,
  ...props
}: ComposerActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full",
            "text-muted-foreground transition-colors duration-150",
            "hover:bg-foreground/10 hover:text-foreground",
            "active:bg-foreground/15",
            "focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
            // Radix marca o trigger com data-state quando o popover abre —
            // mantém o botão aceso enquanto o menu está aberto.
            "data-[state=open]:bg-foreground/10 data-[state=open]:text-foreground",
            "disabled:pointer-events-none disabled:opacity-50",
            "[&>svg]:size-5",
            className,
          )}
          {...props}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
