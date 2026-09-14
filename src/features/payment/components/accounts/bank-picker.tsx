"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { BRAZILIAN_BANKS, searchBanks } from "../../lib/banks";

/**
 * Busca de banco por código ou nome.
 *
 * Devolve nome **e** código: o código COMPE é o mesmo que o extrato OFX traz em
 * `<BANKID>`, então preenchê-lo aqui é o que depois permite reconhecer de qual
 * conta veio o arquivo importado.
 *
 * Banco fora da lista continua possível — o que for digitado e não casar com
 * nenhuma opção é aceito como nome livre.
 */
export function BankPicker({
  bankName,
  bankCode,
  onChange,
}: {
  bankName: string;
  bankCode: string;
  onChange: (value: { bankName: string; bankCode: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = searchBanks(query);
  const typed = query.trim();
  // Só oferece o texto livre quando ele não é um dos resultados — senão a lista
  // mostraria a mesma coisa duas vezes.
  const canUseTyped =
    typed.length > 0 &&
    !results.some((bank) => bank.name.toLowerCase() === typed.toLowerCase());

  function select(name: string, code: string) {
    onChange({ bankName: name, bankCode: code });
    setOpen(false);
    setQuery("");
  }

  const label = bankName
    ? bankCode
      ? `${bankCode} · ${bankName}`
      : bankName
    : "Selecionar banco...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between font-normal"
        >
          <span
            className={cn("flex min-w-0 items-center gap-2", !bankName && "text-muted-foreground")}
          >
            <Landmark className="size-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nome ou número..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {typed ? "Nenhum banco encontrado." : "Digite para buscar."}
            </CommandEmpty>

            {canUseTyped && (
              <CommandGroup heading="Usar o que digitei">
                <CommandItem value={`__livre__${typed}`} onSelect={() => select(typed, "")}>
                  <span className="truncate">{typed}</span>
                </CommandItem>
              </CommandGroup>
            )}

            <CommandGroup heading={query ? "Resultados" : "Bancos"}>
              {results.map((bank) => (
                <CommandItem
                  key={bank.code}
                  value={`${bank.code} ${bank.name}`}
                  onSelect={() => select(bank.name, bank.code)}
                >
                  <Check
                    className={cn(
                      "size-4",
                      bankCode === bank.code ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">
                    {bank.code}
                  </span>
                  <span className="truncate">{bank.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export { BRAZILIAN_BANKS };
