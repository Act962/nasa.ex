"use client";

import { FolderOpen, XIcon } from "lucide-react";
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
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useActionFilters } from "../../hooks/use-action-filters";
import { cn } from "@/lib/utils";

interface Props {
  variant?: "popover" | "list";
}

export function ProjectsFilter({ variant = "popover" }: Props) {
  const { filters, setFilters } = useActionFilters();
  const { data: projectsData, isLoading: isLoadingProjects } = useQuery(
    orpc.orgProjects.list.queryOptions({ input: {} }),
  );

  const projects = projectsData?.projects ?? [];
  const [search, setSearch] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const selectedProjects = filters.projectIds;
  const projectsCount = selectedProjects.length;

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
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const trigger = (
    <Button
      variant={projectsCount > 0 ? "secondary" : "outline"}
      size="sm"
      className={cn(
        "h-7 gap-1.5 text-xs",
        variant === "list" && "w-full justify-start h-9",
      )}
    >
      <FolderOpen className={variant === "list" ? "size-4" : "size-3"} />
      {variant === "list" && projectsCount === 0
        ? "Selecionar projetos"
        : `Projetos (${projectsCount})`}
      {variant === "popover" && projectsCount > 0 && (
        <span className="text-xs font-medium ml-1">{projectsCount}</span>
      )}
    </Button>
  );

  return (
    <div className={cn(variant === "list" && "space-y-2")}>
      {variant === "list" && (
        <h4 className="text-sm font-medium flex items-center gap-2">
          <FolderOpen className="size-4 text-muted-foreground" />
          Projetos/Clientes
        </h4>
      )}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent align="start" className="p-0 w-64">
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
            {projectsCount > 0 && (
              <>
                <CommandSeparator />
                <div className="p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs gap-1"
                    onClick={clearProjects}
                  >
                    <XIcon className="size-3" />
                    Limpar seleção
                  </Button>
                </div>
              </>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
