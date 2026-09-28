"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fieldClass } from "./field";

export interface SelectFieldOption {
  value: string;
  label: string;
}

/**
 * Select do wizard. O nativo herdava a lista do sistema operacional — fundo
 * branco no meio de uma página escura. Aqui a lista é do shadcn e segue o
 * mesmo desenho dos outros campos.
 *
 * Radix não aceita `value=""` em item, então a opção vazia vira placeholder:
 * string vazia no estado equivale a "nada escolhido".
 */
export function SelectField({
  value,
  onChange,
  options,
  placeholder = "Selecione…",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectFieldOption[];
  placeholder?: string;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          fieldClass,
          "shadow-none data-[size=default]:h-auto",
          "data-[placeholder]:text-white/25",
          // O trigger do shadcn troca de fundo no hover (`dark:hover:bg-input/50`).
          // Aqui o campo tem que reagir igual aos inputs ao lado: só a borda.
          "dark:bg-white/[0.04] dark:hover:bg-white/[0.04] hover:border-white/20",
          "focus-visible:border-violet-400/60 focus-visible:ring-0",
          "[&_svg]:text-white/30",
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>

      {/* `dark` fixa os tokens do shadcn no escopo da lista: a landing é escura
          mesmo quando o tema do app está no claro. */}
      <SelectContent
        position="popper"
        className="dark max-h-72 rounded-xl border-white/10"
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="rounded-lg text-white/75 focus:bg-white/[0.07] focus:text-white"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
