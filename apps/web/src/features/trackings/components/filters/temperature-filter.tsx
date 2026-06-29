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
import { cn } from "@/lib/utils";
import { Thermometer, XIcon } from "lucide-react";
import { useQueryState } from "nuqs";

const temperatures = [
  { label: "Gelo", value: "COLD", color: "#3498db" },
  { label: "Morna", value: "WARM", color: "#f1c40f" },
  { label: "Quente", value: "HOT", color: "#e67e22" },
  { label: "Muito Quente", value: "VERY_HOT", color: "#e74c3c" },
];

export function TemperatureFilter() {
  const [temperatureQuery, setTemperatureQuery] = useQueryState("temperature");

  const selectedTemperatures = temperatureQuery
    ? temperatureQuery.split(",")
    : [];

  const handleToggle = (value: string) => {
    const isSelected = selectedTemperatures.includes(value);

    if (isSelected) {
      const newValues = selectedTemperatures.filter((v) => v !== value);
      setTemperatureQuery(newValues.length > 0 ? newValues.join(",") : null);
    } else {
      const newValues = [...selectedTemperatures, value];
      setTemperatureQuery(newValues.join(","));
    }
  };

  const clearAll = () => setTemperatureQuery(null);

  const selectedCount = selectedTemperatures.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={selectedCount > 0 ? "default" : "outline"}
          size="sm"
          className="justify-start"
        >
          <Thermometer className="size-4" />
          Temperatura
          {selectedCount > 0 && <span>{selectedCount}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 w-[200px]">
        <Command>
          <CommandList>
            <CommandGroup>
              {temperatures.map((temp) => {
                const isSelected = selectedTemperatures.includes(temp.value);

                return (
                  <CommandItem
                    key={temp.value}
                    onSelect={() => handleToggle(temp.value)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox checked={isSelected} />
                    <div
                      className="size-2 rounded-full"
                      style={{ backgroundColor: temp.color }}
                    />
                    <span>{temp.label}</span>
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
