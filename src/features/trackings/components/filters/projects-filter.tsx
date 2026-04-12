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
import { orpc } from "@/lib/orpc";
import { FolderOpen, XIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

export function ProjectsFilter() {
  const [open, setOpen] = useState(false);
  const { data: projectsData, isLoading: isLoadingProjects } = useQuery(
    orpc.orgProjects.list.queryOptions({ input: {} })
  );
  const projects = projectsData?.projects ?? [];
  const [search, setSearch] = useState("");

  const [projectFilter, setProjectFilter] = useQueryState("projects");

  // Converte a string da URL em array
  const selectedProjects = projectFilter ? projectFilter.split(",") : [];

  const handleProjectFilter = (projectId: string) => {
    const isSelected = selectedProjects.includes(projectId);

    if (isSelected) {
      // Remove o projeto
      const newProjects = selectedProjects.filter((p) => p !== projectId);
      setProjectFilter(newProjects.length > 0 ? newProjects.join(",") : null);
    } else {
      // Adiciona o projeto
      const newProjects = [...selectedProjects, projectId];
      setProjectFilter(newProjects.join(","));
    }
  };

  const clearAllFilters = () => {
    setProjectFilter(null);
  };

  const selectedCount = selectedProjects.length;

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
                    onSelect={() => handleProjectFilter(project.id)}
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
                onClick={clearAllFilters}
              >
                <XIcon className="size-3" />
                Limpar
              </Button>
            )}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
