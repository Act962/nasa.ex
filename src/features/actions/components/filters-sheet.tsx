"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { orpc } from "@/lib/orpc";
import { FolderOpen, ListFilter, XIcon } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useActionFilters } from "../hooks/use-action-filters";

export function FiltersSheet() {
  const { filters, setFilters } = useActionFilters();
  const { data: projectsData, isLoading: isLoadingProjects } = useQuery(
    orpc.orgProjects.list.queryOptions({ input: {} })
  );
  const projects = projectsData?.projects ?? [];
  const [search, setSearch] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const selectedProjects = filters.projectIds;

  const handleProjectToggle = (projectId: string) => {
    const isSelected = selectedProjects.includes(projectId);
    const newProjects = isSelected
      ? selectedProjects.filter((p) => p !== projectId)
      : [...selectedProjects, projectId];
    setFilters({ ...filters, projectIds: newProjects });
  };

  const clearProjects = () => {
    setFilters({ ...filters, projectIds: [] });
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedCount = selectedProjects.length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon-sm" variant="ghost">
          <ListFilter className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent hideOverlay>
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>
            Aplique filtros para refinar sua busca.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2 px-4">
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={selectedCount > 0 ? "default" : "outline"}
                className="justify-start"
                size="sm"
              >
                <FolderOpen className="size-4" />
                Projetos/Clientes
                {selectedCount > 0 && (
                  <span className="text-xs font-medium">{selectedCount}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-0">
              <Command>
                <CommandInput
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Buscar projetos..."
                />
                <CommandList>
                  <CommandEmpty>
                    {isLoadingProjects
                      ? "Carregando projetos..."
                      : "Nenhum projeto encontrado."}
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredProjects.map((project) => {
                      const isSelected = selectedProjects.includes(project.id);
                      return (
                        <CommandItem
                          key={project.id}
                          value={project.id}
                          className="cursor-pointer"
                          onSelect={() => handleProjectToggle(project.id)}
                        >
                          <Checkbox checked={isSelected} />
                          {project.name}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
                <CommandSeparator />
                <div className="p-2 flex justify-end items-center gap-2">
                  {selectedCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={clearProjects}
                    >
                      <XIcon className="size-3" />
                      Limpar
                    </Button>
                  )}
                </div>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </SheetContent>
    </Sheet>
  );
}
