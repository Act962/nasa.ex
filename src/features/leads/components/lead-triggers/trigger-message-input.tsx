"use client";

import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { LEAD_TRIGGER_VARIABLES } from "@/features/leads/lib/triggers/templates";

// Mensagem do Gatilho do lead (spec 0038, RF-4): digitar "/" abre as
// variáveis; escolher uma troca a barra pela variável.

interface TriggerMessageInputProps {
  value: string;
  onChange: (value: string) => void;
  hasError: boolean;
  surfaceClassName: string;
  hintClassName: string;
}

export function TriggerMessageInput({ value, onChange, hasError, surfaceClassName, hintClassName }: TriggerMessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [slashIndex, setSlashIndex] = useState<number | null>(null);

  const handleChange = (nextValue: string, caret: number) => {
    onChange(nextValue);
    const isSlashJustTyped = nextValue.length > value.length && nextValue[caret - 1] === "/";
    setSlashIndex(isSlashJustTyped ? caret - 1 : null);
  };

  const insertVariable = (token: string) => {
    if (slashIndex === null) return;
    const nextValue = `${value.slice(0, slashIndex)}${token}${value.slice(slashIndex + 1)}`;
    onChange(nextValue);
    setSlashIndex(null);
    const caret = slashIndex + token.length;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="relative flex flex-col gap-1">
      <Textarea
        ref={textareaRef}
        value={value}
        rows={2}
        onChange={(event) => handleChange(event.target.value, event.target.selectionStart)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setSlashIndex(null);
        }}
        onBlur={() => setTimeout(() => setSlashIndex(null), 150)}
        className={cn(
          "min-h-0 resize-none rounded-lg border-0 py-1.5 text-xs shadow-none focus-visible:ring-1",
          surfaceClassName,
          hasError && "ring-1 ring-red-400",
        )}
      />
      <p className={cn("text-[11px]", hasError ? "text-red-400" : hintClassName)}>
        {hasError ? "Inclua {nome} para o nome do lead. " : ""}Clique em &quot;/&quot; para adicionar variáveis.
      </p>
      {slashIndex !== null && (
        <ul className="absolute left-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-lg border bg-popover py-1 text-xs text-popover-foreground shadow-lg">
          {LEAD_TRIGGER_VARIABLES.map((variable) => (
            <li key={variable.token}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertVariable(variable.token)}
                className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-accent"
              >
                <span>{variable.label}</span>
                <code className="text-[10px] text-muted-foreground">{variable.token}</code>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
