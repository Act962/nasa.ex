"use client";

// Texto dos blocos com o seletor de variáveis (spec 0139): as do contato, iguais às do Enviar mensagem dos Gatilhos, e as
// que os blocos do fluxo criam ({{vars.cidade}}). Insere onde está o cursor.
import { createContext, useContext, useRef, useState } from "react";
import { BracesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { PROMO_LOOKUP_VARIABLES, PROMO_RECEIPT_VARIABLES } from "../../lib/nodes";

const CONTACT_VARIABLES = [
  { token: "{{nome}}", label: "Nome" },
  { token: "{{primeiro_nome}}", label: "Primeiro nome" },
  { token: "{{phone}}", label: "Telefone" },
  { token: "{{email}}", label: "E-mail" },
  { token: "{{status}}", label: "Coluna" },
  { token: "{{track}}", label: "Funil" },
  { token: "{{responsavel}}", label: "Responsável" },
  { token: "{{data}}", label: "Data de hoje" },
];

/** Variáveis que os blocos do STAR FRIENDS gravam (spec 0140): ficam sob o próprio título. */
const STAR_FRIENDS_VARIABLES = new Set<string>([...PROMO_RECEIPT_VARIABLES, ...PROMO_LOOKUP_VARIABLES]);

/** Variáveis criadas pelos blocos do fluxo aberto; o painel do bloco fornece. */
export const FlowVariablesContext = createContext<string[]>([]);

interface PickerVariable {
  token: string;
  label: string;
}

function VariableGroup({ title, variables, emptyText, onInsert }: { title: string; variables: PickerVariable[]; emptyText?: string; onInsert: (token: string) => void }) {
  if (variables.length === 0 && !emptyText) return null;
  return (
    <>
      <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground [&:not(:first-child)]:mt-1">{title}</p>
      {variables.length === 0 ? (
        <p className="px-2 pb-1 text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        variables.map((variable) => (
          <button
            key={variable.token}
            type="button"
            onClick={() => onInsert(variable.token)}
            title={variable.token}
            className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
          >
            <span className="min-w-0 flex-1 truncate">{variable.label}</span>
            <span className="max-w-[55%] shrink-0 truncate text-[11px] text-muted-foreground">{variable.token}</span>
          </button>
        ))
      )}
    </>
  );
}

function VariablePicker({ onInsert }: { onInsert: (token: string) => void }) {
  const flowVariables = useContext(FlowVariablesContext);
  const [isOpen, setIsOpen] = useState(false);
  const insert = (token: string) => {
    onInsert(token);
    setIsOpen(false);
  };
  const toFlowVariable = (name: string): PickerVariable => ({ token: `{{vars.${name}}}`, label: name });
  const starFriendsVariables = flowVariables.filter((name) => STAR_FRIENDS_VARIABLES.has(name)).map(toFlowVariable);
  const otherFlowVariables = flowVariables.filter((name) => !STAR_FRIENDS_VARIABLES.has(name)).map(toFlowVariable);
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground">
          <BracesIcon className="size-3.5" /> Variáveis
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={8}
        className="max-h-[min(24rem,var(--radix-popover-content-available-height))] w-72 max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain p-2"
      >
        <VariableGroup title="Do contato" variables={CONTACT_VARIABLES} onInsert={insert} />
        <VariableGroup title="STAR FRIENDS" variables={starFriendsVariables} onInsert={insert} />
        <VariableGroup
          title="Do fluxo"
          variables={otherFlowVariables}
          emptyText={starFriendsVariables.length === 0 ? "Nenhuma ainda. Pergunta, Agente de IA e Distribuir criam variáveis." : undefined}
          onInsert={insert}
        />
      </PopoverContent>
    </Popover>
  );
}

export function VariableTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  maxLength,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const insertAtCursor = (token: string) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  return (
    <div className="rounded-md border border-border focus-within:border-ring">
      <Textarea
        ref={textareaRef}
        rows={rows}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="resize-none border-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <div className="flex items-center gap-1 border-t border-border px-1 py-0.5">
        <VariablePicker onInsert={insertAtCursor} />
        {maxLength !== undefined && (
          <span className="ml-auto pr-1 text-[10px] text-muted-foreground">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
