"use client";

import { useState } from "react";
import { CheckIcon, ChevronsUpDownIcon, FolderIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useOrgProjects } from "../hooks/use-org-projects";

interface ProjectSelectProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
}

export function ProjectSelect({ value, onChange, placeholder = "Selecionar projeto/cliente", className }: ProjectSelectProps) {
  const [open, setOpen] = useState(false);
  const { projects } = useOrgProjects({ isActive: true });

  const selected = projects.find((p: any) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className={cn("w-full justify-between font-normal", className)}>
          <div className="flex items-center gap-2 truncate">
            {selected ? (
              <>
                <div className="size-4 rounded-full shrink-0" style={{ backgroundColor: selected.color ?? "#7c3aed" }} />
                <span className="truncate">{selected.name}</span>
                <span className="text-muted-foreground text-xs">({selected.type})</span>
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>Nenhum projeto/cliente encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__none__" onSelect={() => { onChange(null); setOpen(false); }} className="text-muted-foreground">
                <FolderIcon className="size-4 mr-2 opacity-50" />
                Nenhum
              </CommandItem>
              {projects.map((p: any) => (
                <CommandItem
                  key={p.id}
                  value={p.name}
                  onSelect={() => { onChange(p.id); setOpen(false); }}
                >
                  <div className="size-3.5 rounded-full shrink-0 mr-2" style={{ backgroundColor: p.color ?? "#7c3aed" }} />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground mr-2">{p.type}</span>
                  <CheckIcon className={cn("size-4", value === p.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
