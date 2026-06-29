"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Activity, XIcon } from "lucide-react";
import { useQueryState } from "nuqs";

const statusFlowOptions = [
  { label: "Novo lead", value: "NEW", color: "#8b5cf6" },
  { label: "Em atendimento", value: "ACTIVE", color: "#22c55e" },
  { label: "Aguardando atendimento", value: "WAITING", color: "#f59e0b" },
  { label: "Finalizado", value: "FINISHED", color: "#6b7280" },
];

export function StatusFlowFilter() {
  const [statusFlowQuery, setStatusFlowQuery] = useQueryState("status_flow");

  const selectedValues = statusFlowQuery ? statusFlowQuery.split(",") : [];

  const handleToggle = (value: string) => {
    const isSelected = selectedValues.includes(value);
    if (isSelected) {
      const next = selectedValues.filter((v) => v !== value);
      setStatusFlowQuery(next.length > 0 ? next.join(",") : null);
    } else {
      setStatusFlowQuery([...selectedValues, value].join(","));
    }
  };

  const clearAll = () => setStatusFlowQuery(null);

  const selectedCount = selectedValues.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={selectedCount > 0 ? "default" : "outline"}
          size="sm"
          className="justify-start"
        >
          <Activity className="size-4" />
          Status
          {selectedCount > 0 && <span>{selectedCount}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 w-[220px]">
        <Command>
          <CommandList>
            <CommandGroup>
              {statusFlowOptions.map((opt) => {
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <CommandItem
                    key={opt.value}
                    onSelect={() => handleToggle(opt.value)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox checked={isSelected} />
                    <div
                      className="size-2 rounded-full"
                      style={{ backgroundColor: opt.color }}
                    />
                    <span>{opt.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          <CommandSeparator />
          {selectedCount > 0 && (
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={clearAll}
              >
                <XIcon className="size-3" />
                Limpar filtros
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
