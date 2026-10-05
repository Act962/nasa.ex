"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClientAvatar } from "./client-avatar";
import type { PlannerClient } from "./planner-v2-types";

const SEARCHABLE_FROM_COUNT = 8;

const toSearchKey = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Escolha de um cliente do Planner: lista suspensa com busca, no lugar de uma fileira de botões que cresce com a carteira. */
export function ClientSelect({
  clients,
  options = clients,
  selectedOrganizationId,
  onSelect,
  disabled,
  className,
}: {
  /** Todos os clientes do Planner: a posição na lista define a cor do anel do avatar. */
  clients: PlannerClient[];
  options?: PlannerClient[];
  selectedOrganizationId: string | null;
  onSelect: (organizationId: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedClient = options.find((candidate) => candidate.id === selectedOrganizationId);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label="Cliente"
          disabled={disabled}
          className={cn(
            "inline-flex h-9 w-full max-w-72 items-center gap-2 rounded-full bg-panel py-1 pr-3 pl-2 text-sm transition hover:bg-knob/60 disabled:pointer-events-none disabled:opacity-60",
            className,
          )}
        >
          {selectedClient && (
            <ClientAvatar name={selectedClient.name} logo={selectedClient.logo} clientIndex={clients.indexOf(selectedClient)} />
          )}
          <span className={cn("min-w-0 flex-1 truncate text-left", selectedClient ? "font-semibold" : "text-muted-foreground")}>
            {selectedClient?.name ?? "Escolha o cliente"}
          </span>
          <ChevronDown className="size-3.5 flex-none text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[calc(100vw-1.5rem)] max-w-72 rounded-[18px] p-1.5">
        <Command
          className="bg-transparent"
          filter={(_value, search, keywords) => (toSearchKey(keywords?.join(" ") ?? "").includes(toSearchKey(search)) ? 1 : 0)}
        >
          {options.length >= SEARCHABLE_FROM_COUNT && <CommandInput placeholder="Buscar cliente..." />}
          <CommandList>
            <CommandEmpty>Nenhum cliente com esse nome.</CommandEmpty>
            <CommandGroup className="p-0">
              {options.map((candidate) => (
                <CommandItem
                  key={candidate.id}
                  value={candidate.id}
                  keywords={[candidate.name]}
                  onSelect={() => {
                    onSelect(candidate.id);
                    setIsOpen(false);
                  }}
                  className="gap-2 rounded-xl py-2"
                >
                  <ClientAvatar name={candidate.name} logo={candidate.logo} clientIndex={clients.indexOf(candidate)} />
                  <span className="min-w-0 flex-1 truncate">{candidate.name}</span>
                  {candidate.id === selectedOrganizationId && <Check className="size-4" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
