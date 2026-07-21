"use client";

import { useState } from "react";
import { UserRound, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced";
import { phoneMaskFull } from "@/utils/format-phone";
import { useSearchLeads } from "../../../hooks/use-actions-leads";
import { SidebarField } from "./sidebar-field";

interface LeadFieldProps {
  value?: string | null;
  /** Nome do lead atual, pro trigger não piscar "Sem lead" enquanto busca. */
  currentLeadName?: string | null;
  onValueChange: (value: string | null) => void;
  disabled?: boolean;
}

export function LeadField({
  value,
  currentLeadName,
  onValueChange,
  disabled,
}: LeadFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const { leads, isLoading } = useSearchLeads(debouncedSearch, open);

  const selectedLabel =
    currentLeadName ?? leads.find((lead) => lead.id === value)?.name ?? null;

  const onSelect = (leadId: string) => {
    onValueChange(leadId === value ? null : leadId);
    setOpen(false);
  };

  return (
    <SidebarField label="Lead" icon={<UserRound className="size-3" />}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className="h-8 w-full justify-start bg-background px-3 text-xs font-normal"
          >
            {selectedLabel ? (
              <span className="truncate">{selectedLabel}</span>
            ) : (
              <span className="text-muted-foreground">Sem lead</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="Buscar lead..."
            />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Buscando leads..." : "Nenhum lead encontrado."}
              </CommandEmpty>
              <CommandGroup>
                {leads.map((lead) => (
                  <CommandItem
                    key={lead.id}
                    value={lead.id}
                    className="cursor-pointer"
                    onSelect={() => onSelect(lead.id)}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{lead.name}</span>
                      {lead.phone && (
                        <span className="truncate text-[10px] text-muted-foreground">
                          {phoneMaskFull(lead.phone)}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            {value && (
              <>
                <CommandSeparator />
                <div className="p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full gap-1 text-xs"
                    onClick={() => {
                      onValueChange(null);
                      setOpen(false);
                    }}
                  >
                    <XIcon className="size-3" />
                    Desvincular lead
                  </Button>
                </div>
              </>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </SidebarField>
  );
}
